import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import './OrderTracking.css';
// Import the Leaflet components
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useNavigate, useLocation } from 'react-router-dom';
import Select from 'react-select';
import { components } from 'react-select';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

// This section fixes the default icon path issue with Leaflet and Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Custom Option with divider
const CustomOption = (props) => (
  <>
    <components.Option {...props} />
    {!props.isSelected && <div style={{borderBottom:'1.5px solid #ffb347', margin:'0 8px'}}></div>}
  </>
);

const OrderTracking = () => {
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [allOrders, setAllOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const location = useLocation();

  // Fetch current user on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getUser();
  }, []);

  // Fetch only this user's orders
  useEffect(() => {
    if (!currentUser) return;
    const fetchOrders = async () => {
      setOrdersLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, created_at')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
      if (!error && data) setAllOrders(data);
      setOrdersLoading(false);
    };
    fetchOrders();
  }, [currentUser]);

  // This data fetching logic is now correct and does not need to change.
  useEffect(() => {
    if (!order?.id) return;
    const channel = supabase
      .channel(`public:orders:id=eq.${order.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        async () => {
          if (order?.id) {
            const { data, error: rpcError } = await supabase
              .rpc('get_order_with_geojson_location', { order_id_param: order.id }).single();
            if (!rpcError && data) setOrder(data);
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [order?.id]);

  useEffect(() => {
    // Check for orderId in location.state or query param
    let idFromState = location.state && location.state.orderId;
    let idFromQuery = null;
    if (!idFromState && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      idFromQuery = params.get('orderId');
    }
    const idToUse = idFromState || idFromQuery;
    if (idToUse) {
      setOrderId(idToUse.toString());
      setSelectedOrderId(idToUse);
      setLoading(true);
      setError('');
      supabase
        .rpc('get_order_with_geojson_location', { order_id_param: idToUse })
        .single()
        .then(({ data, error: fetchError }) => {
          if (fetchError || !data) {
            setError('Order not found. Please check the ID and try again.');
            setOrder(null);
            setSelectedOrderId(null);
          } else {
            setOrder(data);
            setSelectedOrderId(data.id);
          }
          setLoading(false);
        });
    }
  }, [location.state]);

  const handleTrackOrder = async (e) => {
    e.preventDefault();
    if (!orderId.trim()) return;
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase
      .rpc('get_order_with_geojson_location', { order_id_param: orderId.trim() }).single();
    if (fetchError || !data) {
      setError('Order not found. Please check the ID and try again.');
      setOrder(null);
      setSelectedOrderId(null);
    } else {
      setOrder(data);
      setSelectedOrderId(data.id);
    }
    setLoading(false);
  };

  const handleOrderClick = async (id) => {
    setOrderId(id.toString());
    setSelectedOrderId(id);
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase
      .rpc('get_order_with_geojson_location', { order_id_param: id }).single();
    if (fetchError || !data) {
      setError('Order not found.');
      setOrder(null);
    } else {
      setOrder(data);
    }
    setLoading(false);
  };
  
  // Revert the parser to the format Leaflet needs: [latitude, longitude]
  const parseLocation = useCallback((locationGeoJSON) => {
    if (!locationGeoJSON || locationGeoJSON.type !== 'Point' || !locationGeoJSON.coordinates) return null;
    const [lon, lat] = locationGeoJSON.coordinates;
    return [lat, lon]; // Leaflet expects [lat, lon] array
  }, []);

  const deliveryLocation = useMemo(() => 
    parseLocation(order?.delivery_person_location),
    [order?.delivery_person_location, parseLocation]
  );
  
  const statusMap = {
    pending: { text: "Pending", progress: 10 },
    confirmed: { text: "Confirmed", progress: 25 },
    ready: { text: "Ready for Pickup", progress: 50 },
    out_for_delivery: { text: "Out for Delivery", progress: 75 },
    delivered: { text: "Delivered", progress: 100 },
    cancelled: { text: "Cancelled", progress: 0 },
  };

  const currentStatus = order ? (statusMap[order.status] || { text: "Unknown", progress: 0 }) : null;

  // Compute latest 3 and remaining orders
  const latestOrders = allOrders.slice(0, 3);
  const remainingOrders = allOrders.slice(3);
  const [dropdownOrderId, setDropdownOrderId] = useState("");

  return (
    <div className="order-tracking-container food-bg-animate">
      {/* Floating food SVGs for background - positioned behind all content */}
      {/* Donut */}
      <svg className="food-float food-float-1" width="48" height="48" viewBox="0 0 48 48" fill="none">
        <ellipse cx="24" cy="24" rx="20" ry="20" fill="#FDE68A" />
        <ellipse cx="24" cy="24" rx="14" ry="14" fill="#fff" />
        <ellipse cx="24" cy="24" rx="8" ry="8" fill="#F59E42" />
        <circle cx="24" cy="24" r="3" fill="#fff" />
        <path d="M18 18 Q24 20 30 18" stroke="#F59E42" strokeWidth="2" fill="none" />
        <path d="M18 30 Q24 28 30 30" stroke="#F59E42" strokeWidth="2" fill="none" />
      </svg>
      
      {/* Pizza Slice */}
      <svg className="food-float food-float-2" width="44" height="44" viewBox="0 0 44 44" fill="none">
        <path d="M22 6 L38 38 Q22 44 6 38 Z" fill="#FFD966" stroke="#B45309" strokeWidth="2" />
        <ellipse cx="22" cy="32" rx="10" ry="4" fill="#F59E42" />
        <circle cx="16" cy="28" r="2" fill="#B91C1C" />
        <circle cx="28" cy="30" r="2" fill="#B91C1C" />
        <circle cx="22" cy="36" r="1.5" fill="#B91C1C" />
      </svg>
      
      {/* Chicken Leg Piece */}
      <svg className="food-float food-float-3" width="40" height="40" viewBox="0 0 40 40" fill="none">
        <ellipse cx="20" cy="28" rx="12" ry="6" fill="#F59E42" />
        <ellipse cx="20" cy="24" rx="10" ry="4" fill="#FDE68A" />
        <ellipse cx="20" cy="20" rx="8" ry="3" fill="#F59E42" />
        <ellipse cx="20" cy="16" rx="6" ry="2" fill="#FDE68A" />
        <ellipse cx="20" cy="12" rx="4" ry="1.5" fill="#F59E42" />
        <ellipse cx="20" cy="8" rx="2" ry="1" fill="#FDE68A" />
      </svg>
      
      {/* Ice Cream Cone */}
      <svg className="food-float food-float-4" width="38" height="38" viewBox="0 0 38 38" fill="none">
        <ellipse cx="19" cy="22" rx="10" ry="6" fill="#FBBF24" />
        <ellipse cx="19" cy="18" rx="8" ry="4" fill="#F59E42" />
        <ellipse cx="19" cy="14" rx="6" ry="3" fill="#F87171" />
        <ellipse cx="19" cy="10" rx="4" ry="2" fill="#A78BFA" />
        <rect x="15" y="22" width="8" height="10" rx="2" fill="#FDE68A" />
        <ellipse cx="19" cy="32" rx="6" ry="2" fill="#F59E42" />
      </svg>
      
      {/* Burger */}
      <svg className="food-float food-float-5" width="36" height="36" viewBox="0 0 36 36" fill="none">
        <ellipse cx="18" cy="13" rx="15" ry="6" fill="#FFD966" stroke="#B45309" strokeWidth="1.5"/>
        <rect x="6" y="18" width="24" height="8" rx="4" fill="#F59E42" stroke="#B45309" strokeWidth="1.5"/>
        <ellipse cx="18" cy="28" rx="12" ry="4" fill="#A3E635" stroke="#15803D" strokeWidth="1.5"/>
      </svg>
      
      {/* French Fries */}
      <svg className="food-float food-float-6" width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="12" y="8" width="8" height="16" rx="2" fill="#FDE68A" />
        <rect x="10" y="10" width="2" height="12" rx="1" fill="#F59E42" />
        <rect x="20" y="10" width="2" height="12" rx="1" fill="#F59E42" />
        <rect x="14" y="12" width="4" height="8" rx="1" fill="#F59E42" />
        <ellipse cx="16" cy="24" rx="6" ry="2" fill="#FDE68A"/>
      </svg>
      
      {/* Hot Dog */}
      <svg className="food-float food-float-7" width="32" height="32" viewBox="0 0 32 32" fill="none">
        <ellipse cx="16" cy="16" rx="12" ry="4" fill="#F59E42" />
        <ellipse cx="16" cy="16" rx="8" ry="2" fill="#FDE68A" />
        <ellipse cx="16" cy="16" rx="4" ry="1" fill="#F59E42" />
      </svg>
      
      {/* Sushi */}
      <svg className="food-float food-float-8" width="28" height="28" viewBox="0 0 28 28" fill="none">
        <ellipse cx="14" cy="18" rx="10" ry="4" fill="#FDE68A" />
        <ellipse cx="14" cy="16" rx="8" ry="3" fill="#F59E42" />
        <ellipse cx="14" cy="14" rx="6" ry="2" fill="#FDE68A" />
        <ellipse cx="14" cy="12" rx="4" ry="1.5" fill="#F59E42" />
      </svg>
      
      {/* Taco */}
      <svg className="food-float food-float-9" width="30" height="30" viewBox="0 0 30 30" fill="none">
        <ellipse cx="15" cy="20" rx="12" ry="6" fill="#FDE68A" />
        <ellipse cx="15" cy="18" rx="10" ry="4" fill="#F59E42" />
        <ellipse cx="15" cy="16" rx="8" ry="3" fill="#A3E635" />
        <ellipse cx="15" cy="14" rx="6" ry="2" fill="#F87171" />
      </svg>
      
      {/* Cupcake */}
      <svg className="food-float food-float-10" width="26" height="26" viewBox="0 0 26 26" fill="none">
        <ellipse cx="13" cy="18" rx="8" ry="3" fill="#FDE68A"/>
        <ellipse cx="13" cy="15" rx="6" ry="2" fill="#fff"/>
        <ellipse cx="13" cy="12" rx="4" ry="1.5" fill="#F59E42"/>
        <ellipse cx="13" cy="9" rx="3" ry="1" fill="#B91C1C"/>
      </svg>
      
      {/* Croissant */}
      <svg className="food-float food-float-11" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <ellipse cx="12" cy="12" rx="10" ry="5" fill="#FDE68A" stroke="#F59E42" strokeWidth="1.5"/>
        <ellipse cx="12" cy="12" rx="6" ry="2" fill="#F59E42" />
      </svg>
      
      {/* Apple */}
      <svg className="food-float food-float-12" width="22" height="22" viewBox="0 0 22 22" fill="none">
        <ellipse cx="11" cy="14" rx="8" ry="6" fill="#F87171" />
        <ellipse cx="11" cy="14" rx="4" ry="3" fill="#FECACA" />
        <rect x="10" y="6" width="2" height="4" rx="1" fill="#65A30D" />
        <ellipse cx="11" cy="6" rx="1.5" ry="0.8" fill="#A3E635" />
      </svg>
      
      {/* Orange */}
      <svg className="food-float food-float-13" width="36" height="36" viewBox="0 0 48 48" fill="none">
        <ellipse cx="24" cy="24" rx="20" ry="20" fill="#FDE68A" />
        <ellipse cx="24" cy="24" rx="14" ry="14" fill="#fff" />
        <ellipse cx="24" cy="24" rx="8" ry="8" fill="#F59E42" />
        <circle cx="24" cy="24" r="3" fill="#fff" />
        <path d="M18 18 Q24 20 30 18" stroke="#F59E42" strokeWidth="2" fill="none" />
        <path d="M18 30 Q24 28 30 30" stroke="#F59E42" strokeWidth="2" fill="none" />
      </svg>
      
      {/* Strawberry */}
      <svg className="food-float food-float-14" width="28" height="28" viewBox="0 0 44 44" fill="none">
        <path d="M22 6 L38 38 Q22 44 6 38 Z" fill="#FFD966" stroke="#B45309" strokeWidth="2" />
        <ellipse cx="22" cy="32" rx="10" ry="4" fill="#F59E42" />
        <circle cx="16" cy="28" r="2" fill="#B91C1C" />
        <circle cx="28" cy="30" r="2" fill="#B91C1C" />
        <circle cx="22" cy="36" r="1.5" fill="#B91C1C" />
      </svg>
      
      {/* Banana */}
      <svg className="food-float food-float-15" width="24" height="24" viewBox="0 0 40 40" fill="none">
        <ellipse cx="20" cy="22" rx="10" ry="4" fill="#fff" />
        <ellipse cx="20" cy="20" rx="8" ry="3" fill="#FDE68A" />
        <ellipse cx="20" cy="18" rx="6" ry="2" fill="#F59E42" />
      </svg>
      
      {/* Grapes */}
      <svg className="food-float food-float-16" width="32" height="32" viewBox="0 0 32 32" fill="none">
        <ellipse cx="16" cy="24" rx="10" ry="4" fill="#FDE68A"/>
        <ellipse cx="16" cy="20" rx="8" ry="3" fill="#fff"/>
        <ellipse cx="16" cy="16" rx="6" ry="2" fill="#F59E42"/>
        <ellipse cx="16" cy="12" rx="4" ry="1.5" fill="#FDE68A"/>
      </svg>
      
      {/* Pineapple */}
      <svg className="food-float food-float-17" width="32" height="32" viewBox="0 0 32 32" fill="none">
        <ellipse cx="16" cy="16" rx="12" ry="4" fill="#FDE68A" />
        <ellipse cx="16" cy="16" rx="8" ry="2" fill="#F59E42" />
        <ellipse cx="16" cy="16" rx="4" ry="1" fill="#FDE68A" />
      </svg>
      
      {/* Watermelon */}
      <svg className="food-float food-float-18" width="32" height="32" viewBox="0 0 32 32" fill="none">
        <ellipse cx="16" cy="16" rx="12" ry="4" fill="#FDE68A" />
        <ellipse cx="16" cy="16" rx="8" ry="2" fill="#F59E42" />
        <ellipse cx="16" cy="16" rx="4" ry="1" fill="#FDE68A" />
      </svg>
      
      {/* Mango */}
      <svg className="food-float food-float-19" width="28" height="28" viewBox="0 0 28 28" fill="none">
        <ellipse cx="14" cy="18" rx="10" ry="4" fill="#FDE68A" />
        <ellipse cx="14" cy="16" rx="8" ry="3" fill="#F59E42" />
        <ellipse cx="14" cy="14" rx="6" ry="2" fill="#FDE68A" />
        <ellipse cx="14" cy="12" rx="4" ry="1.5" fill="#F59E42" />
      </svg>
      
      {/* Kiwi */}
      <svg className="food-float food-float-20" width="30" height="30" viewBox="0 0 30 30" fill="none">
        <ellipse cx="15" cy="18" rx="8" ry="3" fill="#FDE68A"/>
        <ellipse cx="15" cy="15" rx="6" ry="2" fill="#fff"/>
        <ellipse cx="15" cy="12" rx="4" ry="1.5" fill="#F59E42"/>
        <ellipse cx="15" cy="9" rx="3" ry="1" fill="#B91C1C"/>
      </svg>
      <div className="tracking-card">
        <button onClick={() => navigate('/home')} className="back-button">←</button>
        <h1>Track Your Order</h1>
        <p>Enter your order ID below to see its status.</p>
        <form onSubmit={handleTrackOrder} className="tracking-form">
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Enter your order ID"
            className="order-id-input"
          />
          <button type="submit" className="track-button" disabled={loading}>
            {loading ? 'Searching...' : 'Track'}
          </button>
        </form>

        {error && <p className="error-message">{error}</p>}

        {order && (
          <div className="order-status-container">
            <h2>Order Details #{order.id}</h2>
            <div className="status-timeline">
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${currentStatus.progress}%` }}></div>
              </div>
              <p className="current-status-text">Status: <strong>{currentStatus.text}</strong></p>
            </div>
            
            {order.status === 'out_for_delivery' && deliveryLocation && (
              <div className="map-container">
                <h3>Live Delivery Map</h3>
                <MapContainer center={deliveryLocation} zoom={15} scrollWheelZoom={false} style={{ height: '400px', width: '100%' }}>
                  {/* This TileLayer uses the free OpenStreetMap data source */}
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={deliveryLocation}>
                    <Popup>The delivery is here!</Popup>
                  </Marker>
                </MapContainer>
              </div>
            )}
            
            {order.status === 'out_for_delivery' && !deliveryLocation && (
                <div className="delivery-info-placeholder">
                    <p>Waiting for delivery person to start sharing their location...</p>
                </div>
            )}
            {(order.status !== 'out_for_delivery' && order.status !== 'delivered') && (
              <div className="delivery-info-placeholder">
                <p>Your order is being prepared. Live tracking will be available once the delivery starts.</p>
              </div>
            )}
          </div>
        )}

        {/* All Orders List */}
        <div style={{marginTop: 32}}>
          <h2 style={{color:'#ff4d5a', fontWeight:800, fontSize:'1.3rem', marginBottom:12}}>Your Latest Orders</h2>
          {ordersLoading ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              marginTop: '20px'
            }}>
              <DotLottieReact
                src="/animations/orders.lottie"
                loop
                autoplay
                style={{ width: 200, height: 200 }}
              />
            </div>
          ) : allOrders.length === 0 ? (
            <div style={{textAlign:'center', color:'#b36a4a'}}>No orders found.</div>
          ) : (
            <>
              <ul style={{listStyle:'none', padding:0, margin:0}}>
                {latestOrders.map(o => (
                  <li key={o.id}
                    onClick={() => handleOrderClick(o.id)}
                    style={{
                      background: selectedOrderId === o.id ? 'linear-gradient(90deg,#ffb347,#fff7ed)' : '#fffdfa',
                      border: selectedOrderId === o.id ? '2.5px solid #ff4d5a' : '2px solid #ffb347',
                      borderRadius:14,
                      marginBottom:14,
                      padding:'14px 18px',
                      boxShadow:'0 2px 8px rgba(255,179,71,0.07)',
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'space-between',
                      fontWeight:600,
                      cursor:'pointer',
                      transition:'background 0.2s, border 0.2s'
                    }}
                  >
                    <span style={{color:'#ff4d5a'}}>#{o.id}</span>
                    <span style={{color:'#b36a4a', fontSize:'0.98rem'}}>{new Date(o.created_at).toLocaleString()}</span>
                    <span style={{
                      background: o.status==='delivered' ? '#28a745' : o.status==='out_for_delivery' ? 'linear-gradient(90deg,#ffb347,#ff4d5a)' : '#ffb347',
                      color: o.status==='delivered' ? '#fff' : '#fff',
                      borderRadius:12,
                      padding:'6px 16px',
                      fontWeight:700,
                      fontSize:'0.98rem',
                      minWidth:90,
                      textAlign:'center'
                    }}>{o.status}</span>
                  </li>
                ))}
              </ul>
              <div className="other-orders-title">Other Orders:</div>
              <div style={{ marginBottom: 10 }}>
                <Select
                  classNamePrefix="order-dropdown"
                  options={remainingOrders.map(order => ({
                    value: order.id,
                    label: `#${order.id} — ${new Date(order.created_at).toLocaleString()} (${order.status})`,
                  }))}
                  value={remainingOrders.find(o => o.id === Number(dropdownOrderId)) ? {
                    value: dropdownOrderId,
                    label: `#${dropdownOrderId} — ${new Date(remainingOrders.find(o => o.id === Number(dropdownOrderId)).created_at).toLocaleString()} (${remainingOrders.find(o => o.id === Number(dropdownOrderId)).status})`
                  } : null}
                  onChange={async (selected) => {
                    if (!selected) {
                      // Handle clear action
                      setDropdownOrderId("");
                      setOrderId("");
                      setSelectedOrderId(null);
                      setOrder(null);
                      setError("");
                      return;
                    }
                    setDropdownOrderId(selected.value);
                    setOrderId(selected.value.toString());
                    setSelectedOrderId(Number(selected.value));
                    setLoading(true);
                    setError("");
                    const { data, error: fetchError } = await supabase
                      .rpc('get_order_with_geojson_location', { order_id_param: selected.value }).single();
                    if (fetchError || !data) {
                      setError('Order not found.');
                      setOrder(null);
                    } else {
                      setOrder(data);
                    }
                    setLoading(false);
                  }}
                  placeholder="Select an order..."
                  isClearable
                  components={{ Option: CustomOption }}
                  styles={{
                    control: (base) => ({
                      ...base,
                      background: '#fffdfa',
                      borderColor: '#ffb347',
                      borderRadius: 8,
                      fontSize: '1.05rem',
                      color: '#b36a4a',
                      boxShadow: 'none',
                      minHeight: 44,
                      paddingLeft: 2,
                    }),
                    option: (base, state) => ({
                      ...base,
                      color: state.isSelected ? '#fff' : '#b36a4a',
                      background: state.isSelected ? 'linear-gradient(90deg, #ff4d5a 0%, #ffb347 100%)' : '#fff',
                      fontWeight: state.isSelected ? 700 : 500,
                      fontSize: '1.05rem',
                      cursor: 'pointer',
                      position: 'relative',
                      paddingBottom: 8,
                      paddingTop: 8,
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 9999,
                      borderRadius: 8,
                      background: '#fffdfa',
                      boxShadow: '0 4px 24px rgba(255,77,90,0.10)',
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: '#b36a4a',
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: '#ff4d5a',
                      fontWeight: 700,
                    }),
                    dropdownIndicator: (base) => ({
                      ...base,
                      color: '#ffb347',
                    }),
                    clearIndicator: (base) => ({
                      ...base,
                      color: '#ff4d5a',
                    }),
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderTracking;