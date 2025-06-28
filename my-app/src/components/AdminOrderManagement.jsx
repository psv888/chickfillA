import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './AdminOrderManagement.css';

const AdminOrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryPersonnel, setDeliveryPersonnel] = useState([]);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [showOnlineDropdown, setShowOnlineDropdown] = useState(false);
  const navigate = useNavigate();

  // Order status configuration
  const orderStatuses = {
    'pending': { label: 'Order Placed', icon: '📋', color: '#ff9800' },
    'confirmed': { label: 'Order Confirmed', icon: '✅', color: '#4caf50' },
    'preparing': { label: 'Preparing', icon: '👨‍🍳', color: '#2196f3' },
    'ready': { label: 'Ready for Pickup', icon: '📦', color: '#9c27b0' },
    'out_for_delivery': { label: 'Out for Delivery', icon: '🚚', color: '#ff5722' },
    'delivered': { label: 'Delivered', icon: '🎉', color: '#4caf50' },
    'cancelled': { label: 'Cancelled', icon: '❌', color: '#f44336' }
  };

  useEffect(() => {
    fetchOrders();
    fetchDeliveryPersonnel();

    // Set up real-time subscription for order updates
    const ordersSubscription = supabase
      .channel('admin_orders_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('Order update received:', payload);
          fetchOrders(); // Refresh orders when there's an update
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersSubscription);
    };
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => setSearchDebounce(searchQuery), 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            dishes (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveryPersonnel = async () => {
    const { data, error } = await supabase.from('delivery_personnel').select('*');
    if (error) {
      console.error('Error fetching delivery personnel:', error);
    } else {
      setDeliveryPersonnel(data);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      
      // Update local state
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));

      // Close selected order if it was the one updated
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status');
    }
  };

  const assignDeliveryPerson = async (orderId, personnelId) => {
    if (!personnelId) {
      alert('Please select a delivery person.');
      return;
    }
    try {
      const { error } = await supabase
        .from('orders')
        .update({ delivery_person_id: personnelId, status: 'confirmed' })
        .eq('id', orderId);

      if (error) throw error;
      
      // Manually update local state to reflect the change immediately
      setOrders(prevOrders => prevOrders.map(order => 
        order.id === orderId 
          ? { ...order, delivery_person_id: personnelId, status: 'confirmed' } 
          : order
      ));
      setSelectedOrder(null); // Close the details view
      alert('Order assigned successfully!');

    } catch (error) {
      console.error('Error assigning delivery person:', error);
      alert('Failed to assign delivery person.');
    }
  };

  const getOrderStatus = (order) => {
    return orderStatuses[order.status] || orderStatuses['pending'];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTotal = (orderItems) => {
    return orderItems.reduce((total, item) => {
      return total + (item.price_at_order * item.quantity);
    }, 0);
  };

  const getOrderItemsText = (orderItems) => {
    const items = orderItems.map(item => 
      `${item.dishes?.name || 'Unknown'} (${item.quantity})`
    );
    return items.join(', ');
  };

  const handleOrderClick = (order) => {
    setSelectedOrder(selectedOrder?.id === order.id ? null : order);
  };

  const filteredOrders = useMemo(() => orders.filter(order => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesSearch = searchDebounce === '' || 
      order.name.toLowerCase().includes(searchDebounce.toLowerCase()) ||
      order.id.toString().includes(searchDebounce) ||
      order.phone.includes(searchDebounce);
    return matchesStatus && matchesSearch;
  }), [orders, filterStatus, searchDebounce]);

  const getStatusCount = useCallback((status) => {
    return orders.filter(order => order.status === status).length;
  }, [orders]);

  if (loading) {
    return (
      <div className="admin-order-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-order-container">
      <div className="admin-header" style={{
        background: 'linear-gradient(90deg, #1a73e8 0%, #4f8cff 100%)',
        color: '#fff',
        borderRadius: '0 0 18px 18px',
        padding: '32px 32px 24px 32px',
        marginBottom: 32,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        boxShadow: '0 2px 12px rgba(26,115,232,0.08)'
      }}>
        <button className="back-btn" onClick={() => navigate('/admin-home')} style={{background:'rgba(255,255,255,0.12)', border:'none', borderRadius:8, color:'#fff', fontSize:22, padding:8, marginRight:18, cursor:'pointer'}}>
          <span className="material-icons">arrow_back</span>
        </button>
        <span style={{fontSize:36, marginRight:12}}>📦</span>
        <div>
          <h1 style={{margin:0, fontWeight:800, fontSize:'2.1rem', letterSpacing:'-1px'}}>Order Management</h1>
          <div style={{fontSize:'1.1rem', opacity:0.85, fontWeight:400}}>Manage, track, and update all customer orders</div>
        </div>
      </div>

      <div className="order-stats" style={{display:'flex', gap:18, marginBottom:32}}>
        <div className="stat-card" style={{background:'#fff', borderRadius:14, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', padding:'18px 28px', display:'flex', flexDirection:'column', alignItems:'center', minWidth:120}}>
          <div style={{fontSize:32, marginBottom:4}}>📦</div>
          <div className="stat-number" style={{fontWeight:700, fontSize:22}}>{orders.length}</div>
          <div className="stat-label" style={{fontSize:14, color:'#888'}}>Total Orders</div>
        </div>
        <div className="stat-card" style={{background:'#fff', borderRadius:14, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', padding:'18px 28px', display:'flex', flexDirection:'column', alignItems:'center', minWidth:120}}>
          <div style={{fontSize:32, marginBottom:4, color:'#ff9800'}}>📋</div>
          <div className="stat-number" style={{fontWeight:700, fontSize:22}}>{getStatusCount('pending')}</div>
          <div className="stat-label" style={{fontSize:14, color:'#888'}}>Pending</div>
        </div>
        <div className="stat-card" style={{background:'#fff', borderRadius:14, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', padding:'18px 28px', display:'flex', flexDirection:'column', alignItems:'center', minWidth:120}}>
          <div style={{fontSize:32, marginBottom:4, color:'#2196f3'}}>👨‍🍳</div>
          <div className="stat-number" style={{fontWeight:700, fontSize:22}}>{getStatusCount('preparing')}</div>
          <div className="stat-label" style={{fontSize:14, color:'#888'}}>Preparing</div>
        </div>
        <div className="stat-card" style={{background:'#fff', borderRadius:14, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', padding:'18px 28px', display:'flex', flexDirection:'column', alignItems:'center', minWidth:120}}>
          <div style={{fontSize:32, marginBottom:4, color:'#ff5722'}}>🚚</div>
          <div className="stat-number" style={{fontWeight:700, fontSize:22}}>{getStatusCount('out_for_delivery')}</div>
          <div className="stat-label" style={{fontSize:14, color:'#888'}}>In Delivery</div>
        </div>
        <div className="stat-card" style={{background:'#fff', borderRadius:14, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', padding:'18px 28px', display:'flex', flexDirection:'column', alignItems:'center', minWidth:120}}>
          <div style={{fontSize:32, marginBottom:4, color:'#4caf50'}}>🎉</div>
          <div className="stat-number" style={{fontWeight:700, fontSize:22}}>{getStatusCount('delivered')}</div>
          <div className="stat-label" style={{fontSize:14, color:'#888'}}>Delivered</div>
        </div>
        <div className="stat-card" style={{background:'#fff', borderRadius:14, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', padding:'18px 28px', display:'flex', flexDirection:'column', alignItems:'center', minWidth:120, position:'relative', cursor:'pointer'}}
          onClick={() => setShowOnlineDropdown(v => !v)}
          onMouseLeave={() => setShowOnlineDropdown(false)}
        >
          <div style={{fontSize:32, marginBottom:4, color:'#3ec16c'}}>🟢</div>
          <div className="stat-number" style={{fontWeight:700, fontSize:22}}>
            {deliveryPersonnel.filter(p => p.is_online).length}
          </div>
          <div className="stat-label" style={{fontSize:14, color:'#888'}}>Available Delivery Boys</div>
          {showOnlineDropdown && (
            <div style={{
              position:'absolute',
              top:'100%',
              left:'50%',
              transform:'translateX(-50%)',
              background:'#fff',
              border:'2px solid #1a73e8',
              borderRadius:14,
              boxShadow:'0 8px 32px rgba(26,115,232,0.18), 0 2px 8px rgba(0,0,0,0.10)',
              minWidth:280,
              zIndex:2000,
              marginTop:18,
              padding:'10px 0',
              maxHeight:300,
              overflowY:'auto',
              display:'block',
            }}>
              {/* Caret/arrow */}
              <div style={{
                position:'absolute',
                top:-14,
                left:'50%',
                transform:'translateX(-50%)',
                width:0,
                height:0,
                borderLeft:'12px solid transparent',
                borderRight:'12px solid transparent',
                borderBottom:'14px solid #1a73e8',
                zIndex:2001,
              }} />
              <div style={{
                position:'absolute',
                top:-12,
                left:'50%',
                transform:'translateX(-50%)',
                width:0,
                height:0,
                borderLeft:'10px solid transparent',
                borderRight:'10px solid transparent',
                borderBottom:'12px solid #fff',
                zIndex:2002,
              }} />
              {deliveryPersonnel.filter(p => p.is_online).length === 0 ? (
                <div style={{padding:'10px 18px', color:'#888'}}>No delivery boys online</div>
              ) : deliveryPersonnel.filter(p => p.is_online).map((p, idx, arr) => (
                <div
                  key={p.id}
                  style={{
                    padding:'12px 18px',
                    borderBottom: idx !== arr.length-1 ? '1px solid #f0f4fa' : 'none',
                    display:'flex',
                    alignItems:'center',
                    gap:12,
                    cursor:'pointer',
                    transition:'background 0.18s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='#f5faff'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  <span style={{
                    display:'inline-flex',
                    alignItems:'center',
                    justifyContent:'center',
                    width:32,
                    height:32,
                    borderRadius:'50%',
                    background:'#e0f7fa',
                    fontWeight:700,
                    fontSize:18,
                    color:'#1a73e8',
                  }}>{p.full_name?.[0]?.toUpperCase() || <span className="material-icons">person</span>}</span>
                  <div style={{display:'flex', flexDirection:'column', flex:1}}>
                    <span style={{fontWeight:700, fontSize:16, color:'#222', marginBottom:2}}>{p.full_name}</span>
                    <span style={{color:'#888', fontSize:13}}>{p.phone_number}</span>
                    {p.zipcode && <span style={{color:'#1a73e8', fontSize:13}}>Zip: {p.zipcode}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="filters-section" style={{display:'flex', alignItems:'center', gap:18, marginBottom:24}}>
        <div className="search-bar" style={{
          flex:1,
          position:'relative',
          background:'#fff',
          borderRadius:32,
          boxShadow:'0 2px 8px rgba(26,115,232,0.08)',
          border:'2px solid #1a73e8',
          minWidth:320,
          maxWidth:480,
          height:54,
          display:'flex',
          alignItems:'center',
          marginRight:18
        }}>
          <span className="search-icon material-icons" style={{position:'absolute', left:22, top:'50%', transform:'translateY(-50%)', color:'#1a73e8', fontSize:28, zIndex:2}}>search</span>
          <input
            type="text"
            placeholder="Search by customer name, order ID, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width:'100%',
              padding:'14px 54px 14px 58px',
              borderRadius:32,
              border:'none',
              outline:'none',
              fontSize:18,
              background:'transparent',
              color:'#222',
              fontWeight:500
            }}
          />
          {searchQuery && (
            <span className="material-icons" style={{position:'absolute', right:22, top:'50%', transform:'translateY(-50%)', color:'#888', fontSize:26, cursor:'pointer', zIndex:2}} onClick={()=>setSearchQuery('')}>close</span>
          )}
        </div>
        <div className="status-filters" style={{display:'flex', gap:8}}>
          <button 
            className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
            style={{borderRadius:20, padding:'8px 18px', border:'1.5px solid #e0e7ef', background: filterStatus==='all' ? '#1a73e8' : '#fff', color: filterStatus==='all' ? '#fff' : '#222', fontWeight:600, fontSize:15, transition:'all 0.2s'}}
          >
            All ({orders.length})
          </button>
          {Object.entries(orderStatuses).map(([key, status]) => (
            <button 
              key={key}
              className={`filter-btn ${filterStatus === key ? 'active' : ''}`}
              onClick={() => setFilterStatus(key)}
              style={{
                borderRadius:20,
                padding:'8px 18px',
                border:'1.5px solid #e0e7ef',
                background: filterStatus===key ? status.color : '#fff',
                color: filterStatus===key ? '#fff' : '#222',
                fontWeight:600,
                fontSize:15,
                transition:'all 0.2s',
                boxShadow: filterStatus===key ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              {status.icon} {status.label} ({getStatusCount(key)})
            </button>
          ))}
        </div>
      </div>

      <div className="orders-list" style={{marginTop:24}}>
        {filteredOrders.length === 0 ? (
          <div className="no-orders">
            <div className="no-orders-icon" style={{fontSize:48}}>📦</div>
            <h3 style={{marginTop:8}}>No Orders Found</h3>
            <p style={{color:'#888'}}>No orders match your current filters.</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} className="order-card" style={{background:'#fff', borderRadius:16, boxShadow:'0 2px 12px rgba(0,0,0,0.07)', marginBottom:24, transition:'box-shadow 0.2s', cursor:'pointer', border: selectedOrder?.id===order.id ? '2.5px solid #1a73e8' : '2.5px solid transparent'}} onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 18px rgba(26,115,232,0.13)'} onMouseLeave={e=>e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,0.07)'}>
              <div className="order-header" onClick={() => handleOrderClick(order)} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 28px', borderBottom:'1.5px solid #f0f4fa'}}>
                <div className="order-info">
                  <h3 style={{margin:'0 0 4px 0', fontWeight:700, fontSize:'1.18rem'}}>Order #{order.id}</h3>
                  <p className="order-date" style={{margin:0, color:'#888', fontSize:13}}>{formatDate(order.created_at)}</p>
                  <p className="customer-info" style={{margin:'6px 0 0 0', fontWeight:500, fontSize:15}}>
                    <span style={{background:'#e0e7ef', borderRadius:'50%', padding:'4px 10px', marginRight:8, fontWeight:700, color:'#1a73e8'}}>{order.name?.[0]?.toUpperCase() || '?'}</span>
                    <strong>{order.name}</strong> • {order.phone}
                  </p>
                  <p className="order-items" style={{margin:'6px 0 0 0', color:'#444', fontSize:14}}>{getOrderItemsText(order.order_items)}</p>
                </div>
                <div className="order-status" style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8}}>
                  <div 
                    className="status-badge"
                    style={{ backgroundColor: getOrderStatus(order).color, color:'#fff', borderRadius:18, padding:'6px 16px', fontWeight:600, fontSize:15, display:'flex', alignItems:'center', gap:8 }}
                  >
                    <span className="status-icon">{getOrderStatus(order).icon}</span>
                    <span className="status-label">{getOrderStatus(order).label}</span>
                  </div>
                  <div className="order-total" style={{fontWeight:700, fontSize:18, color:'#1a73e8'}}>₹{calculateTotal(order.order_items)}</div>
                </div>
              </div>
              {selectedOrder?.id === order.id && (
                <div className="order-details" style={{padding:'28px 32px', background:'#f8fafc', borderRadius:'0 0 16px 16px', borderTop:'1.5px solid #f0f4fa', marginTop:-2}}>
                  <div className="order-details-grid" style={{display:'flex', gap:32, flexWrap:'wrap'}}>
                    <div className="detail-section" style={{flex:'1 1 220px', minWidth:220}}>
                      <h4 style={{margin:'0 0 12px 0', fontWeight:700, fontSize:16}}>Customer Details</h4>
                      <div className="detail-item"><span className="label">Name:</span> <span className="value">{order.name}</span></div>
                      <div className="detail-item"><span className="label">Phone:</span> <span className="value">{order.phone}</span></div>
                      <div className="detail-item"><span className="label">Address:</span> <span className="value">{order.address}</span></div>
                      <div className="detail-item"><span className="label">Order Time:</span> <span className="value">{formatDate(order.created_at)}</span></div>
                    </div>
                    <div className="detail-section" style={{flex:'1 1 220px', minWidth:220}}>
                      <h4 style={{margin:'0 0 12px 0', fontWeight:700, fontSize:16}}>Order Actions</h4>
                      <div className="status-update-buttons" style={{display:'flex', flexDirection:'column', gap:8, marginBottom:18}}>
                        {Object.entries(orderStatuses).map(([key, status]) => (
                          <button
                            key={key}
                            className="status-update-btn"
                            style={{ background: status.color, color:'#fff', border:'none', borderRadius:8, padding:'8px 0', fontWeight:600, fontSize:15, cursor:'pointer', transition:'background 0.2s' }}
                            onClick={() => updateOrderStatus(order.id, key)}
                          >
                            {status.icon} Set to "{status.label}"
                          </button>
                        ))}
                      </div>
                      <div className="assign-delivery" style={{marginTop:12}}>
                        <h4 style={{margin:'0 0 8px 0', fontWeight:700, fontSize:15}}>Assign Delivery Person</h4>
                        <select 
                          value={selectedPersonnelId} 
                          onChange={(e) => setSelectedPersonnelId(e.target.value)}
                          className="personnel-select"
                          style={{padding:'8px 12px', borderRadius:8, border:'1.5px solid #e0e7ef', fontSize:15, marginBottom:8}}
                        >
                          <option value="">Select a person...</option>
                          {deliveryPersonnel.map(person => (
                            <option key={person.id} value={person.id}>
                              {person.full_name} - {person.phone_number}
                            </option>
                          ))}
                        </select>
                        <button style={{background:'#1a73e8', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontWeight:600, fontSize:15, cursor:'pointer'}} onClick={() => assignDeliveryPerson(order.id, selectedPersonnelId)}>
                          🚚 Assign & Confirm Order
                        </button>
                      </div>
                    </div>
                    <div className="detail-section" style={{flex:'1 1 220px', minWidth:220}}>
                      <h4 style={{margin:'0 0 12px 0', fontWeight:700, fontSize:16}}>Order Items</h4>
                      {order.order_items.map((item, index) => (
                        <div key={index} className="order-item" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                          <div className="item-info" style={{display:'flex', alignItems:'center', gap:8}}>
                            <span className="item-name" style={{fontWeight:600}}>{item.dishes?.name || 'Unknown Item'}</span>
                            <span className="item-quantity" style={{background:'#e0e7ef', borderRadius:8, padding:'2px 8px', fontWeight:600, fontSize:13, color:'#1a73e8'}}>x{item.quantity}</span>
                          </div>
                          <span className="item-price" style={{fontWeight:600, color:'#222'}}>₹{item.price_at_order * item.quantity}</span>
                        </div>
                      ))}
                      <div className="order-total-item" style={{marginTop:12, fontWeight:700, fontSize:16, display:'flex', justifyContent:'space-between'}}>
                        <span className="total-label">Total:</span>
                        <span className="total-amount" style={{color:'#1a73e8'}}>₹{calculateTotal(order.order_items)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="quick-actions" style={{marginTop:24, borderTop:'1.5px solid #e0e7ef', paddingTop:18}}>
                    <h4 style={{margin:'0 0 12px 0', fontWeight:700, fontSize:16}}>Quick Actions</h4>
                    <div className="action-buttons" style={{display:'flex', gap:14, flexWrap:'wrap'}}>
                      <button 
                        className="action-btn call-btn"
                        style={{background:'#4caf50', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontWeight:600, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', gap:6}}
                        onClick={() => window.open(`tel:${order.phone}`)}
                      >
                        <span className="material-icons">call</span> Call Customer
                      </button>
                      <button 
                        className="action-btn message-btn"
                        style={{background:'#2196f3', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontWeight:600, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', gap:6}}
                        onClick={() => window.open(`sms:${order.phone}`)}
                      >
                        <span className="material-icons">sms</span> Send SMS
                      </button>
                      <button 
                        className="action-btn copy-btn"
                        style={{background:'#ff9800', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontWeight:600, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', gap:6}}
                        onClick={() => {
                          navigator.clipboard.writeText(`Order #${order.id} - ${order.name} - ${order.phone}`);
                          alert('Order details copied to clipboard!');
                        }}
                      >
                        <span className="material-icons">content_copy</span> Copy Details
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminOrderManagement; 