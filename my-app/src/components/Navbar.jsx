import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../CartContext';
import ReactModal from 'react-modal';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import './Navbar.css';
import './LoginSuccessAnimation.css';
import ReactDOM from 'react-dom';
import { loadRazorpayScript, createRazorpayOrder } from '../utils/razorpay';

const Navbar = ({ searchQuery, onSearchChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const { cart, addToCart, removeFromCart, clearCart } = useCart();
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const navigate = useNavigate();

  const [checkoutStep, setCheckoutStep] = useState('cart');
  const [orderDetails, setOrderDetails] = useState({ name: '', phone: '', address: '' });
  const [orderId, setOrderId] = useState('');
  const [allItems, setAllItems] = useState([]);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  
  // New state for payment success flow
  const [showOrderAnimation, setShowOrderAnimation] = useState(false);
  const [showOrderPopup, setShowOrderPopup] = useState(false); // false | 'anim' | true
  const [popupOrderId, setPopupOrderId] = useState('');
  const [popupUsername, setPopupUsername] = useState('');
  const [orderCount, setOrderCount] = useState(0);

  // Confetti icons for burst animation (strictly match TiffinsPage)
  const blastIcons = ['🎉', '🎊', '😁', '🤩'];

  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.dish.price * item.quantity, 0);
  const cartParentItem = allItems.find(item => item.id === cartItems[0]?.dish.parent_id);

  useEffect(() => {
    const fetchAllItems = async () => {
      const { data } = await supabase.from('admin_items').select('*');
      setAllItems(data || []);
    };
    fetchAllItems();
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching user:', error);
      } else {
        setUser(data.user);
      }
    };
    fetchUser();
  }, []);

  // Add Razorpay script loader
  useEffect(() => {
    // If Razorpay is already loaded, set razorpayLoaded to true immediately
    if (window.Razorpay) {
      setRazorpayLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => setRazorpayLoaded(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay script');
      setRazorpayLoaded(false);
    };
    document.body.appendChild(script);
    // Clean up: remove script if component unmounts
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
    } else {
      navigate('/login');
    }
  };

  // Enhanced Razorpay payment handler
  function handleRazorpayPayment() {
    try {
      const amount = cartItems.reduce((sum, item) => sum + item.dish.price * item.quantity, 0);
      
      const options = {
        amount: amount * 100, // in paise
        handler: async function (response) {
          // On payment success, insert order and order items
          const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert([{
              name: orderDetails.name,
              phone: orderDetails.phone,
              address: orderDetails.address,
              total_price: cartTotal,
              user_id: user?.id || null,
            }])
            .select()
            .single();
          if (orderError) {
            alert('Order failed: ' + orderError.message);
            return;
          }
          const orderItems = cartItems.map(item => ({
            order_id: order.id,
            dish_id: item.dish.id,
            quantity: item.quantity,
            price_at_order: item.dish.price,
          }));
          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);
          if (itemsError) {
            alert('Order items failed: ' + itemsError.message);
            return;
          }
          setPopupOrderId(order.id); // Use the auto-incremented order id
          setPopupUsername(orderDetails.name || (user && user.email ? user.email.split("@")[0] : "Guest"));
          setShowOrderAnimation(true); // Show delivery animation
          setOrderCount(prev => prev + 1);
          clearCart();
          setTimeout(() => setShowOrderPopup('anim'), 2000); // After delivery animation, show order confirmed anim
        },
        prefill: {
          name: orderDetails.name,
          email: '',
          contact: orderDetails.phone
        },
        notes: {
          address: orderDetails.address
        }
      };
      
      const rzp = createRazorpayOrder(options);
      rzp.open();
    } catch (error) {
      console.error('Payment initialization error:', error);
      alert('Payment initialization failed. Please try again or contact support.');
    }
  }

  useEffect(() => {
    if (cartModalOpen) {
      setCheckoutStep('cart');
    }
  }, [cartModalOpen]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const username = user?.email?.split('@')[0] || 'Guest';

  // Add OrderAnimation component
  function OrderAnimation({ orderId, onDone }) {
    // Show order ID after 5 seconds
    const [showOrderId, setShowOrderId] = useState(false);
    useEffect(() => {
      const timer = setTimeout(() => {
        setShowOrderId(true);
        setTimeout(() => onDone && onDone(), 1000); // show orderId for 1s
      }, 5000); // 5 seconds
      return () => clearTimeout(timer);
    }, [onDone]);

    return (
      <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:320, width:'100%', background:'none', boxShadow:'none'}}>
        <DotLottieReact
          src="/animations/delivery boy.lottie"
          loop
          autoplay
          style={{ width: 320, height: 320, background: 'none', boxShadow: 'none', display: 'block', margin: '0 auto' }}
        />
      </div>
    );
  }

  // Add OrderBlastAnimation component (single burst, pixel-perfect match)
  function OrderBlastAnimation({ onAnimationEnd }) {
    const [confetti, setConfetti] = React.useState([]);
    const burstDuration = 5 * 1000; // 5 seconds
    const confettiCount = 32; // Icons per burst (for density)

    React.useEffect(() => {
      // Generate all confetti at once
      setConfetti(Array.from({ length: confettiCount }, (_, index) => {
        const angle = (index / confettiCount) * 360 + Math.random() * 10;
        const distance = 100 + Math.random() * 50;
        const speed = 4 + Math.random() * 4;
        const rotation = Math.random() * 720;
        return {
          icon: blastIcons[Math.floor(Math.random() * blastIcons.length)],
          angle,
          distance,
          speed,
          rotation,
          delay: 0,
          size: 1.5 + Math.random() * 1,
          pieceIndex: index
        };
      }));
      // End the blast after 5 seconds
      const timer = setTimeout(() => {
        onAnimationEnd();
      }, burstDuration);
      return () => clearTimeout(timer);
    }, [onAnimationEnd]);

    return (
      <div className="animation-container order-blast-animation">
        <div className="lottie-wrapper">
          <DotLottieReact
            src="/animations/order confirmed.lottie"
            loop={false}
            autoplay
            style={{ width: '100%', height: '100%' }}
          />
          <div style={{
            textAlign: 'center',
            fontWeight: 800,
            fontSize: '2.2rem',
            color: '#1a7f37',
            marginTop: 18,
            letterSpacing: 1,
            textShadow: '0 2px 8px #fff, 0 1px 0 #b2f2dd',
          }}>
            Order Confirmed!
          </div>
        </div>
        {confetti.map((piece, index) => {
          const radians = (piece.angle * Math.PI) / 180;
          const endX = Math.cos(radians) * piece.distance;
          const endY = Math.sin(radians) * piece.distance;
          return (
            <div
              key={`confetti-piece-${index}`}
              className="confetti-piece"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                fontSize: `${piece.size}rem`,
                animation: `confetti-burst-${index} ${piece.speed}s ease-out forwards`,
                animationDelay: `0s`,
                transform: `translate(-50%, -50%)`,
                pointerEvents: 'none',
              }}
            >
              <style jsx>{`
                @keyframes confetti-burst-${index} {
                  0% {
                    transform: translate(-50%, -50%) rotate(0deg) scale(0);
                    opacity: 1;
                  }
                  10% {
                    transform: translate(-50%, -50%) rotate(${piece.rotation * 0.1}deg) scale(1);
                    opacity: 1;
                  }
                  100% {
                    transform: translate(calc(-50% + ${endX}vw), calc(-50% + ${endY}vh)) rotate(${piece.rotation}deg) scale(0.8);
                    opacity: 0;
                  }
                }
              `}</style>
              {piece.icon}
            </div>
          );
        })}
      </div>
    );
  }

  // Render the blast animation as a full-screen overlay at the root (pixel-perfect match)
  function FullScreenBlast({ show, onDone }) {
    if (!show) return null;
    return ReactDOM.createPortal(
      <OrderBlastAnimation onAnimationEnd={onDone} />, 
      document.body
    );
  }

  return (
    <>
      <FullScreenBlast show={showOrderPopup === 'anim'} onDone={() => setShowOrderPopup(true)} />
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button className="close-btn" onClick={toggleSidebar}>
            <span className="material-icons">arrow_back</span>
          </button>
        </div>
        <div className="profile-section">
          <span className="profile-icon material-icons">account_circle</span>
          <span className="welcome-text">Welcome, {username}</span>
        </div>
        <button 
          className="order-tracking-btn"
          onClick={() => navigate('/order-tracking')}
          style={{ margin: '20px auto', display: 'block', width: '80%' }}
        >
          <span className="tracking-icon">📦</span>
          <span className="tracking-text">Track Your Order</span>
        </button>
        <div className="sidebar-footer">
          <button className="logout-action" onClick={handleLogout}>
            <span className="material-icons">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
      {isOpen && <div className="overlay" onClick={toggleSidebar}></div>}
      
      <header className="navbar-header">
        <button className="hamburger-btn" onClick={toggleSidebar}>
          <span className="material-icons">menu</span>
        </button>
        <div className="search-container">
          <div className="search-bar">
            <span className="search-icon material-icons">search</span>
            <input
              type="text"
              placeholder="Search for restaurants, cuisines or dishes..."
              value={searchQuery}
              onChange={onSearchChange}
            />
          </div>
        </div>
        <button className="cart-btn" onClick={() => setCartModalOpen(true)}>
          <span className="material-icons">shopping_cart</span>
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>
      </header>

      <ReactModal
        isOpen={cartModalOpen}
        onRequestClose={() => setCartModalOpen(false)}
        className="admin-menu-modal cart-background"
        overlayClassName="admin-menu-modal-overlay"
        contentLabel="Cart Modal"
      >
        <button className="admin-menu-modal-close" onClick={() => setCartModalOpen(false)}>&times;</button>
        <h2 className="cart-title">Your Cart</h2>
        {cartParentItem && <div className="cart-restaurant-name">{cartParentItem.name}</div>}
        {checkoutStep === 'cart' && (
          cartItems.length === 0 ? (
            <div className="cart-empty-message">
              <DotLottieReact
                src="/animations/sad.lottie"
                loop
                autoplay
                style={{ width: 180, height: 180, marginBottom: 16 }}
              />
              <span>Your cart is empty.</span>
            </div>
          ) : (
            <div className="cart-content">
              <div className="cart-items-list">
                {cartItems.map((item) => (
                  <div key={item.dish.id} className="cart-item">
                    <div className="cart-item-details">
                      <div className="cart-item-name">{item.dish.name}</div>
                      <div className="cart-item-price">₹{item.dish.price}</div>
                    </div>
                    <div className="cart-item-controls">
                      <button className="quantity-btn" onClick={() => removeFromCart(item.dish)}>
                        <span className="material-icons">remove</span>
                      </button>
                      <span className="quantity-display">{item.quantity}</span>
                      <button className="quantity-btn" onClick={() => addToCart(item.dish)}>
                        <span className="material-icons">add</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="cart-summary">
                <div className="cart-total">
                  <span>Total:</span>
                  <span className="total-amount">₹{cartTotal.toFixed(2)}</span>
                </div>
                <button className="cart-checkout-btn" onClick={() => setCheckoutStep('form')}>
                  Proceed to Checkout
                </button>
              </div>
            </div>
          )
        )}
        {checkoutStep === 'form' && !showOrderPopup && (
          <form onSubmit={e => { e.preventDefault(); handleRazorpayPayment(); }} style={{ padding: '20px 0' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Name:</label>
              <input
                type="text"
                required
                value={orderDetails.name}
                onChange={e => setOrderDetails({...orderDetails, name: e.target.value})}
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd', fontSize: 16 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Phone:</label>
              <input
                type="tel"
                required
                value={orderDetails.phone}
                onChange={e => setOrderDetails({...orderDetails, phone: e.target.value})}
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd', fontSize: 16 }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Address:</label>
              <textarea
                required
                value={orderDetails.address}
                onChange={e => setOrderDetails({...orderDetails, address: e.target.value})}
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd', fontSize: 16, minHeight: 80 }}
              />
            </div>
            <div style={{display:'flex', gap:10}}>
              {showOrderAnimation ? (
                <OrderAnimation orderId={popupOrderId} onDone={() => {}} />
              ) : (
                <>
                  <button 
                    type="submit" 
                    disabled={!razorpayLoaded}
                    style={{ 
                      flex:1, 
                      background: razorpayLoaded ? '#ff4d5a' : '#ccc', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: 8, 
                      padding: '12px 0', 
                      fontWeight: 600, 
                      fontSize: '1.08rem', 
                      cursor: razorpayLoaded ? 'pointer' : 'not-allowed' 
                    }}
                  >
                    {razorpayLoaded ? 'Pay & Place Order' : 'Loading Payment...'}
                  </button>
                  <button type="button" onClick={() => setCheckoutStep('cart')} style={{flex:1, background:'#eee', color:'#444', border:'none', borderRadius:8, padding:'12px 0', fontWeight:600, fontSize:'1.08rem', cursor:'pointer'}}>Back</button>
                </>
              )}
            </div>
            {!razorpayLoaded && (
              <div style={{textAlign: 'center', marginTop: 8, fontSize: '0.9rem', color: '#666'}}>
                Loading payment gateway...
              </div>
            )}
          </form>
        )}
        {/* Enhanced order details modal */}
        <ReactModal
          isOpen={showOrderPopup === true}
          onRequestClose={() => { setShowOrderPopup(false); setCheckoutStep('cart'); }}
          className="admin-menu-modal cart-background"
          overlayClassName="admin-menu-modal-overlay"
          contentLabel="Order Details Modal"
        >
          <button className="admin-menu-modal-close" onClick={() => { setShowOrderPopup(false); setCheckoutStep('cart'); }}>&times;</button>
          <h2 style={{color:'#1a73e8', marginBottom: 18}}>Order Placed!</h2>
          <div style={{fontSize: '1.1rem', marginBottom: 8}}>Your Order ID is: <b>{popupOrderId}</b></div>
          <button onClick={() => { setShowOrderPopup(false); setCheckoutStep('cart'); }} style={{background:'#ff4d5a', color:'#fff', border:'none', borderRadius:8, padding:'10px 28px', fontWeight:600, fontSize:'1.08rem', cursor:'pointer', marginTop:18}}>Close</button>
        </ReactModal>
      </ReactModal>
    </>
  );
};

export default Navbar; 