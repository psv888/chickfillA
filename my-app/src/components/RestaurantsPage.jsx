import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import ReactModal from 'react-modal';
import './RestaurantsPage.css';
import { useCart } from '../CartContext';
import ReviewSection from './ReviewSection';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import RestaurantCard from './RestaurantCard';
import './LoginSuccessAnimation.css';
import ReactDOM from 'react-dom';
import { loadRazorpayScript, createRazorpayOrder } from '../utils/razorpay';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getUserLocation, getLatLngFromZip, getDistanceKm } from '../utils/locationFiltering';
import { useNavigate } from 'react-router-dom';

if (L && L.Icon && L.Icon.Default) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  });
}



export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [search, setSearch] = useState('');
  const [menuModalParent, setMenuModalParent] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [dishSearch, setDishSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const { cart, addToCart: originalAddToCart, removeFromCart, clearCart } = useCart();
  const [checkoutStep, setCheckoutStep] = useState('cart'); // 'cart' | 'form' | 'confirm'
  const [orderDetails, setOrderDetails] = useState({ name: '', phone: '', address: '' });
  const [orderId, setOrderId] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [showCartBar, setShowCartBar] = useState(false);
  const [userZipcode, setUserZipcode] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  
  // New state for payment success flow
  const [showOrderAnimation, setShowOrderAnimation] = useState(false);
  const [showOrderPopup, setShowOrderPopup] = useState(false); // false | 'anim' | true
  const [popupOrderId, setPopupOrderId] = useState('');
  const [popupUsername, setPopupUsername] = useState('');
  const [orderCount, setOrderCount] = useState(0);
  const [showBlast, setShowBlast] = React.useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [orderTrackingOrder, setOrderTrackingOrder] = useState(null);
  const [orderTrackingLoading, setOrderTrackingLoading] = useState(false);
  const [orderTrackingError, setOrderTrackingError] = useState('');

  // Define username for use in order placement
  const username = orderDetails.name || (currentUser && currentUser.email ? currentUser.email.split("@")[0] : "Guest");

  const navigate = useNavigate();

  ReactModal.setAppElement('#root');

  // Confetti icons for burst animation
  const blastIcons = ['🎉', '🎊', '😁', '🤩'];

  const addToCart = (dish) => {
    const cartItems = Object.values(cart);
    if (cartItems.length > 0 && cartItems[0].dish.parent_id !== dish.parent_id) {
      if (window.confirm('Your cart contains items from another restaurant. Would you like to clear it and add this item?')) {
        clearCart();
        originalAddToCart(dish);
      }
    } else {
      originalAddToCart(dish);
    }
  };

  // Get user location and filter restaurants
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setLocationLoading(true);
      try {
        // Get user's zipcode
        const userZip = await getUserLocation();
        setUserZipcode(userZip);
        // Get all restaurants
        const { data: allRestaurants, error } = await supabase
          .from('admin_items')
          .select('*')
          .eq('section', 'restaurants');
        if (error) {
          setRestaurants(allRestaurants || []);
          return;
        }
        // Geocode user zipcode only
        const userLatLng = await getLatLngFromZip(userZip);
        if (!userLatLng) {
          setRestaurants(allRestaurants || []);
          return;
        }
        // Filter by location using stored lat/lng
        const filteredRestaurants = (allRestaurants || []).filter(r => {
          if (r.latitude == null || r.longitude == null) return false;
          const dist = getDistanceKm(userLatLng.lat, userLatLng.lon, r.latitude, r.longitude);
          r.distance = dist;
          return dist <= 10;
        });
        filteredRestaurants.sort((a, b) => (a.distance || 0) - (b.distance || 0));
        setRestaurants(filteredRestaurants);
      } catch (error) {
        setRestaurants([]);
      } finally {
        setLoading(false);
        setLocationLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data?.user || null);
    });
  }, []);

  const openMenuModal = async (parent) => {
    setMenuModalParent(parent);
    setDishSearch('');
    const { data } = await supabase.from('dishes').select('*').eq('parent_id', parent.id);
    setDishes(data || []);
  };

  // Cart summary helpers
  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.dish.price * item.quantity, 0);
  const cartRestaurant = restaurants.find(r => r.id === cartItems[0]?.dish.parent_id);

  // Show cart bar when an item is added
  useEffect(() => {
    if (cartCount > 0) {
      setShowCartBar(true);
    } else {
      setShowCartBar(false);
    }
  }, [cartCount]);

  // Add Razorpay script loader
  useEffect(() => {
    loadRazorpayScript().catch(error => {
      console.error('Failed to load Razorpay:', error);
    });
  }, []);

  // Add Razorpay payment handler - FIXED VERSION
  async function handleRazorpayPayment(e) {
    e.preventDefault();
    try {
      await loadRazorpayScript();
      const amount = cartItems.reduce((sum, item) => sum + item.dish.price * item.quantity, 0);
      const username = orderDetails.name || (currentUser && currentUser.email ? currentUser.email.split("@") [0] : "Guest");
      const options = {
        amount: amount * 100,
        handler: async function (response) {
          const orderResponse = await fetch('https://chickfilla.onrender.com/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: orderDetails.name,
              phone: orderDetails.phone,
              address: orderDetails.address,
              total_price: cartTotal,
              user_id: currentUser?.id || null,
              restaurant_id: cartRestaurant?.id,
            })
          });
          const result = await orderResponse.json();
          if (result.error) {
            alert('Order failed: ' + result.error);
            return;
          }
          const order = result.order;
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
          clearCart();
          setOrderCount(prev => prev + 1);
          navigate('/order-tracking', { state: { orderId: order.id } });
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

  // Reset checkout step when opening/closing cart modal
  useEffect(() => {
    if (cartModalOpen) setCheckoutStep('cart');
  }, [cartModalOpen]);

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
        <div style={{height: 0, position:'relative'}}>
          {/* Order ID pops up after animation */}
          <div style={{
            opacity: showOrderId ? 1 : 0,
            transform: showOrderId ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.5s, transform 0.5s',
            position: 'absolute',
            left: '50%',
            top: '-30px',
            transform: 'translateX(-50%)',
            background: '#fff7ed',
            border: '2.5px solid #ffb347',
            borderRadius: 12,
            padding: '10px 28px',
            fontWeight: 700,
            fontSize: '1.2rem',
            color: '#ff4d5a',
            boxShadow: '0 2px 8px rgba(255,179,71,0.13)',
            zIndex: 2,
            marginTop: 12,
            display: orderId ? 'block' : 'none'
          }}>{orderId}</div>
        </div>
      </div>
    );
  }

  // Add OrderConfirmedAnimation component
  function OrderConfirmedAnimation({ onDone }) {
    const [showText, setShowText] = useState(false);
    useEffect(() => {
      const timer = setTimeout(() => {
        setShowText(true);
        setTimeout(() => onDone && onDone(), 2000); // show text for 2s
      }, 1000); // 1 second delay
      return () => clearTimeout(timer);
    }, [onDone]);

    return (
      <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16}}>
        <DotLottieReact
          src="/animations/order confirmed.lottie"
          loop={false}
          autoplay
          style={{ width: 200, height: 200 }}
        />
        {showText && (
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'2rem', fontWeight:800, color:'#1a7f37', marginBottom:8}}>Order Confirmed!</div>
            <div style={{fontSize:'1.2rem', color:'#666'}}>Thank you for your order! 🎉</div>
          </div>
        )}
      </div>
    );
  }

  // Add OrderBlastAnimation component
  function OrderBlastAnimation({ onAnimationEnd }) {
    const [confettiBursts, setConfettiBursts] = React.useState([]);
    const burstDuration = 5 * 1000; // 5 seconds
    const burstInterval = 400; // New burst every 400ms
    const confettiCount = 32; // Icons per burst (for density)

    React.useEffect(() => {
      let burstTimer;
      let endTimer;
      let running = true;
      // Start the blast after 1 second
      const startBlast = setTimeout(() => {
        let burstIndex = 0;
        function addBurst() {
          if (!running) return;
          setConfettiBursts(bursts => [
            ...bursts,
            Array.from({ length: confettiCount }, (_, index) => {
              const angle = (index / confettiCount) * 360 + Math.random() * 10; // Spread in 360
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
                burstIndex,
                pieceIndex: index
              };
            })
          ]);
          burstIndex++;
          burstTimer = setTimeout(addBurst, burstInterval);
        }
        addBurst();
        // End the blast after 5 seconds
        endTimer = setTimeout(() => {
          running = false;
          onAnimationEnd();
        }, burstDuration);
      }, 1000);
      return () => {
        running = false;
        clearTimeout(startBlast);
        clearTimeout(burstTimer);
        clearTimeout(endTimer);
      };
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
        {confettiBursts.map((burst, burstIdx) => burst.map((piece, index) => {
          const radians = (piece.angle * Math.PI) / 180;
          const endX = Math.cos(radians) * piece.distance;
          const endY = Math.sin(radians) * piece.distance;
          return (
            <div
              key={`burst-${burstIdx}-piece-${index}`}
              className="confetti-piece"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                fontSize: `${piece.size}rem`,
                animation: `confetti-burst-${burstIdx}-${index} ${piece.speed}s ease-out forwards`,
                animationDelay: `0s`,
                transform: `translate(-50%, -50%)`,
                pointerEvents: 'none',
              }}
            >
              <style jsx>{`
                @keyframes confetti-burst-${burstIdx}-${index} {
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
        }))}
      </div>
    );
  }

  // Render the blast animation as a full-screen overlay at the root
  function FullScreenBlast({ show, onDone }) {
    if (!show) return null;
    return ReactDOM.createPortal(
      <OrderBlastAnimation onAnimationEnd={onDone} />,
      document.body
    );
  }

  const statusMap = {
    pending: { text: "Pending", progress: 10 },
    confirmed: { text: "Confirmed", progress: 25 },
    ready: { text: "Ready for Pickup", progress: 50 },
    out_for_delivery: { text: "Out for Delivery", progress: 75 },
    delivered: { text: "Delivered", progress: 100 },
    cancelled: { text: "Cancelled", progress: 0 },
  };
  const parseLocation = (locationGeoJSON) => {
    if (!locationGeoJSON || locationGeoJSON.type !== 'Point' || !locationGeoJSON.coordinates) return null;
    const [lon, lat] = locationGeoJSON.coordinates;
    return [lat, lon];
  };
  const deliveryLocation = parseLocation(orderTrackingOrder?.delivery_person_location);
  const currentStatus = orderTrackingOrder ? (statusMap[orderTrackingOrder.status] || { text: "Unknown", progress: 0 }) : null;

  useEffect(() => {
    if (!showTrackingModal || !popupOrderId) return;
    setOrderTrackingLoading(true);
    setOrderTrackingError('');
    setOrderTrackingOrder(null);
    supabase.rpc('get_order_with_geojson_location', { order_id_param: popupOrderId }).single()
      .then(({ data, error }) => {
        if (error || !data) {
          setOrderTrackingError('Order not found.');
          setOrderTrackingOrder(null);
        } else {
          setOrderTrackingOrder(data);
        }
        setOrderTrackingLoading(false);
      });
    const channel = supabase
      .channel(`public:orders:id=eq.${popupOrderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${popupOrderId}` },
        async () => {
          const { data, error } = await supabase.rpc('get_order_with_geojson_location', { order_id_param: popupOrderId }).single();
          if (!error && data) setOrderTrackingOrder(data);
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [showTrackingModal, popupOrderId]);

  return (
    <div className="register-bg food-bg-animate" style={{minHeight:'100vh', width:'100vw', position:'relative'}}>
      {/* Blast animation overlay (full screen, outside modal) */}
      <FullScreenBlast show={showOrderPopup === 'anim'} onDone={() => setShowOrderPopup(true)} />
      {/* 15 floating food SVGs for background, same as login/register */}
      {/* Donut */}
      <svg className="food-float food-float-1" width="48" height="48" viewBox="0 0 48 48" fill="none"><ellipse cx="24" cy="24" rx="20" ry="20" fill="#FDE68A" /><ellipse cx="24" cy="24" rx="14" ry="14" fill="#fff" /><ellipse cx="24" cy="24" rx="8" ry="8" fill="#F59E42" /><circle cx="24" cy="24" r="3" fill="#fff" /><path d="M18 18 Q24 20 30 18" stroke="#F59E42" strokeWidth="2" fill="none" /><path d="M18 30 Q24 28 30 30" stroke="#F59E42" strokeWidth="2" fill="none" /></svg>
      {/* Pizza Slice */}
      <svg className="food-float food-float-2" width="44" height="44" viewBox="0 0 44 44" fill="none"><path d="M22 6 L38 38 Q22 44 6 38 Z" fill="#FFD966" stroke="#B45309" strokeWidth="2" /><ellipse cx="22" cy="32" rx="10" ry="4" fill="#F59E42" /><circle cx="16" cy="28" r="2" fill="#B91C1C" /><circle cx="28" cy="30" r="2" fill="#B91C1C" /><circle cx="22" cy="36" r="1.5" fill="#B91C1C" /></svg>
      {/* Pie */}
      <svg className="food-float food-float-3" width="40" height="40" viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="28" rx="16" ry="8" fill="#F59E42" /><ellipse cx="20" cy="24" rx="14" ry="6" fill="#FFD966" /><ellipse cx="20" cy="22" rx="10" ry="4" fill="#fff" /><ellipse cx="20" cy="22" rx="4" ry="2" fill="#F59E42" /><path d="M8 28 Q20 34 32 28" stroke="#B45309" strokeWidth="2" fill="none" /></svg>
      {/* Burger */}
      <svg className="food-float food-float-4" width="38" height="38" viewBox="0 0 38 38" fill="none"><ellipse cx="19" cy="13" rx="15" ry="6" fill="#FFD966" stroke="#B45309" strokeWidth="1.5"/><rect x="6" y="18" width="26" height="8" rx="4" fill="#F59E42" stroke="#B45309" strokeWidth="1.5"/><ellipse cx="19" cy="28" rx="12" ry="4" fill="#A3E635" stroke="#15803D" strokeWidth="1.5"/></svg>
      {/* Croissant */}
      <svg className="food-float food-float-5" width="36" height="36" viewBox="0 0 36 36" fill="none"><ellipse cx="18" cy="18" rx="14" ry="7" fill="#FDE68A" stroke="#F59E42" strokeWidth="1.5"/><ellipse cx="18" cy="18" rx="8" ry="3" fill="#F59E42" /></svg>
      {/* Cupcake */}
      <svg className="food-float food-float-6" width="32" height="32" viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="24" rx="10" ry="4" fill="#FDE68A"/><ellipse cx="16" cy="20" rx="8" ry="3" fill="#fff"/><ellipse cx="16" cy="16" rx="6" ry="2" fill="#F59E42"/><ellipse cx="16" cy="12" rx="4" ry="1.5" fill="#B91C1C"/></svg>
      {/* Repeat and vary for 15 total */}
      <svg className="food-float food-float-7" width="32" height="32" viewBox="0 0 48 48" fill="none"><ellipse cx="24" cy="24" rx="20" ry="20" fill="#FDE68A" /><ellipse cx="24" cy="24" rx="14" ry="14" fill="#fff" /><ellipse cx="24" cy="24" rx="8" ry="8" fill="#F59E42" /><circle cx="24" cy="24" r="3" fill="#fff" /></svg>
      <svg className="food-float food-float-8" width="28" height="28" viewBox="0 0 44 44" fill="none"><path d="M22 6 L38 38 Q22 44 6 38 Z" fill="#FFD966" stroke="#B45309" strokeWidth="2" /></svg>
      <svg className="food-float food-float-9" width="30" height="30" viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="28" rx="16" ry="8" fill="#F59E42" /></svg>
      <svg className="food-float food-float-10" width="26" height="26" viewBox="0 0 38 38" fill="none"><ellipse cx="19" cy="13" rx="15" ry="6" fill="#FFD966" /></svg>
      <svg className="food-float food-float-11" width="24" height="24" viewBox="0 0 36 36" fill="none"><ellipse cx="18" cy="18" rx="14" ry="7" fill="#FDE68A" /></svg>
      <svg className="food-float food-float-12" width="22" height="22" viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="24" rx="10" ry="4" fill="#FDE68A"/></svg>
      <svg className="food-float food-float-13" width="36" height="36" viewBox="0 0 48 48" fill="none"><ellipse cx="24" cy="24" rx="20" ry="20" fill="#FDE68A" /></svg>
      <svg className="food-float food-float-14" width="28" height="28" viewBox="0 0 44 44" fill="none"><ellipse cx="22" cy="32" rx="10" ry="4" fill="#F59E42" /></svg>
      <svg className="food-float food-float-15" width="24" height="24" viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="22" rx="10" ry="4" fill="#fff" /></svg>
      {/* Main content */}
      <div style={{position:'relative', zIndex:2}}>
        <div className="category-search-bar" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="material-icons">search</span>
          <input
            type="text"
            placeholder="Search restaurants..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span style={{ marginLeft: 'auto', cursor: 'pointer', position: 'relative' }} onClick={() => setCartModalOpen(true)}>
            <span className="material-icons" style={{ fontSize: 28, color: '#ff4d5a' }}>shopping_cart</span>
            {cartCount > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -8, background: '#ff4d5a', color: '#fff', borderRadius: '50%', fontSize: 13, padding: '2px 6px', fontWeight: 600 }}>{cartCount}</span>
            )}
          </span>
        </div>
        {/* THIS IS THE BAR TO REMOVE */}
        {/* {showCartBar && cartCount > 0 && (
          <div className="cart-bottom-bar">
            <span className="cart-bar-left">{cartCount} Item{cartCount > 1 ? 's' : ''} added</span>
            <span className="cart-bar-right" onClick={() => setCartModalOpen(true)}>View Cart <span className="material-icons" style={{fontSize:18, verticalAlign:'middle'}}>chevron_right</span></span>
          </div>
        )} */}
        {loading ? (
          <div className="register-logo food-bounce" style={{ marginBottom: '12px', marginTop: '32px', display:'flex', justifyContent:'center' }}>
            <DotLottieReact
              src="/animations/loading.lottie"
              loop
              autoplay
              style={{ width: 180, height: 180 }}
            />
          </div>
        ) : (
          <>
            {/* Location indicator */}
            {userZipcode && (
              <div style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                color: 'white', 
                padding: '12px 16px', 
                borderRadius: '12px', 
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px'
              }}>
                <span>📍</span>
                <span>Showing restaurants near your location (Zip: {userZipcode})</span>
                {restaurants.length > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.9 }}>
                    {restaurants.length} restaurant{restaurants.length > 1 ? 's' : ''} found
                  </span>
                )}
              </div>
            )}
            
            {/* No restaurants found message */}
            {restaurants.length === 0 && !loading && (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px',
                color: '#666'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🍕</div>
                <h3 style={{ marginBottom: '8px', color: '#333' }}>No restaurants found nearby</h3>
                <p style={{ marginBottom: '16px' }}>
                  We couldn't find any restaurants within 50km of your location.
                </p>
                {userZipcode && (
                  <p style={{ fontSize: '14px', color: '#888' }}>
                    Your zipcode: {userZipcode}
                  </p>
                )}
              </div>
            )}
            
            {/* Restaurants grid */}
            {restaurants.length > 0 && (
              <div className="category-cards-grid">
                {restaurants
                  .filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
                  .map((r, idx) => (
                    <RestaurantCard key={idx} restaurant={r} onCardClick={() => openMenuModal(r)} />
                  ))}
              </div>
            )}
          </>
        )}
      </div>
      <ReactModal
        isOpen={!!menuModalParent}
        onRequestClose={() => setMenuModalParent(null)}
        className="admin-menu-modal menu-modal-bg"
        overlayClassName="admin-menu-modal-overlay"
        contentLabel="Menu Modal"
      >
        <button className="admin-menu-modal-close" onClick={() => setMenuModalParent(null)}>&times;</button>
        <div style={{ overflowY: 'auto', height: 'calc(100% - 70px)'}}>
        {menuModalParent && (
          <>
            <h2 style={{textAlign: 'center', marginBottom: 12}}>{menuModalParent.name} Menu</h2>
            <div style={{textAlign: 'center', color: '#888', marginBottom: 18}}>{menuModalParent.location}</div>
            <input
              className="admin-dish-search"
              type="text"
              placeholder="Search dishes..."
              value={dishSearch}
              onChange={e => setDishSearch(e.target.value)}
              style={{marginBottom: 10, marginTop: 2, padding: '6px 10px', borderRadius: 6, border: '1px solid #eee', width: '90%'}}
            />
            <div className="admin-dashboard-dishes-cards">
              {dishes
                .filter(dish =>
                  !dishSearch || dish.name.toLowerCase().includes(dishSearch.toLowerCase())
                )
                .map((dish, dIdx) => (
                  <div key={dIdx} className="admin-dashboard-dish-card">
                    <img src={dish.photo_url} alt={dish.name} className="admin-dashboard-dish-img" />
                    <div className="admin-dashboard-dish-info">
                      <div className="admin-dashboard-dish-name">{dish.name}</div>
                      <div className="admin-dashboard-dish-price">₹{dish.price}</div>
                        <div className="admin-dashboard-dish-actions">
                        {cart[dish.id]?.quantity > 0 ? (
                          <>
                            <button onClick={() => removeFromCart(dish)} style={{ padding: '2px 10px', fontSize: 20, borderRadius: 6, border: '1px solid #eee', background: '#fafbfc', cursor: cart[dish.id] ? 'pointer' : 'not-allowed', color: cart[dish.id] ? '#ff4d5a' : '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="material-icons">remove</span>
                            </button>
                            <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 600 }}>{cart[dish.id]?.quantity}</span>
                              <button onClick={() => originalAddToCart(dish)} style={{ padding: '2px 10px', fontSize: 20, borderRadius: 6, border: '1px solid #eee', background: '#fafbfc', cursor: 'pointer', color: '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="material-icons">add</span>
                            </button>
                          </>
                        ) : (
                          <button className="add-btn" onClick={() => addToCart(dish)}>
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            <ReviewSection user={currentUser} restaurantId={menuModalParent.id} />
          </>
        )}
        </div>
        {showCartBar && cartCount > 0 && (
          <div className="cart-bottom-bar">
            <span className="cart-bar-left">{cartCount} Item{cartCount > 1 ? 's' : ''} added</span>
            <span className="cart-bar-right" onClick={() => setCartModalOpen(true)}>
              <span>View Cart</span>
              <span className="material-icons">chevron_right</span>
            </span>
          </div>
        )}
      </ReactModal>
      {/* Cart Modal */}
      <ReactModal
        isOpen={cartModalOpen}
        onRequestClose={() => setCartModalOpen(false)}
        className="admin-menu-modal cart-background"
        overlayClassName="admin-menu-modal-overlay"
        contentLabel="Cart Modal"
      >
        <button className="admin-menu-modal-close" onClick={() => setCartModalOpen(false)}>&times;</button>
        <h2 className="cart-title">Your Cart</h2>
        {cartRestaurant && <div className="cart-restaurant-name">{cartRestaurant.name}'s Restaurant</div>}
        {checkoutStep === 'cart' && (
          cartItems.length === 0 ? (
            <div className="cart-empty-message">
              <DotLottieReact
                src="/animations/sad.lottie"
                loop
                autoplay
                style={{ width: 180, height: 180, marginBottom: 16 }}
              />
              <span>i am hungry, feed me</span>
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
                      <button onClick={() => removeFromCart(item.dish)} className="quantity-btn">
                        <span className="material-icons">remove</span>
                      </button>
                      <span className="quantity-display">{item.quantity}</span>
                      <button onClick={() => addToCart(item.dish)} className="quantity-btn">
                        <span className="material-icons">add</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="cart-summary">
                <div className="cart-total">
                  <span>Total</span>
                  <span className="total-amount">₹{cartTotal}</span>
                </div>
                <button onClick={() => setCheckoutStep('form')} className="cart-checkout-btn">Checkout</button>
              </div>
            </div>
          )
        )}
        {checkoutStep === 'form' && !showOrderPopup && (
          <form onSubmit={handleRazorpayPayment} style={{marginTop:8}}>
            <input
              type="text"
              placeholder="Name"
              value={orderDetails.name}
              onChange={e => setOrderDetails({ ...orderDetails, name: e.target.value })}
              required
              style={{width:'100%', marginBottom:10, padding:8, borderRadius:6, border:'1px solid #eee'}}
            />
            <input
              type="text"
              placeholder="Phone"
              value={orderDetails.phone}
              onChange={e => setOrderDetails({ ...orderDetails, phone: e.target.value })}
              required
              style={{width:'100%', marginBottom:10, padding:8, borderRadius:6, border:'1px solid #eee'}}
            />
            <textarea
              placeholder="Delivery Address"
              value={orderDetails.address}
              onChange={e => setOrderDetails({ ...orderDetails, address: e.target.value })}
              required
              style={{width:'100%', marginBottom:10, padding:8, borderRadius:6, border:'1px solid #eee', minHeight:60}}
            />
            <div style={{display:'flex', gap:10}}>
              {showOrderAnimation ? (
                <OrderAnimation orderId={popupOrderId} onDone={() => { setShowOrderAnimation(false); setShowOrderPopup('anim'); }} />
              ) : (
                <>
                  <button type="submit" style={{flex:1, background:'#ff4d5a', color:'#fff', border:'none', borderRadius:8, padding:'12px 0', fontWeight:600, fontSize:'1.08rem', cursor:'pointer'}}>Pay & Place Order</button>
                  <button type="button" onClick={() => setCheckoutStep('cart')} style={{flex:1, background:'#eee', color:'#444', border:'none', borderRadius:8, padding:'12px 0', fontWeight:600, fontSize:'1.08rem', cursor:'pointer'}}>Back</button>
                </>
              )}
            </div>
          </form>
        )}
      </ReactModal>
      {/* Separate modal for order details after order is placed */}
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
        <button
          onClick={() => setShowTrackingModal(true)}
          style={{background:'#ff4d5a', color:'#fff', border:'none', borderRadius:8, padding:'10px 28px', fontWeight:600, fontSize:'1.08rem', cursor:'pointer', marginTop:18}}
        >Track Order</button>
      </ReactModal>
      <ReactModal
        isOpen={showTrackingModal}
        onRequestClose={() => setShowTrackingModal(false)}
        className="admin-menu-modal cart-background"
        overlayClassName="admin-menu-modal-overlay"
        contentLabel="Order Tracking Modal"
      >
        <button className="admin-menu-modal-close" onClick={() => setShowTrackingModal(false)}>&times;</button>
        <h2 style={{color:'#1a73e8', marginBottom: 18}}>Order Tracking</h2>
        <div style={{fontSize: '1.1rem', marginBottom: 8}}>Order ID: <b>{popupOrderId}</b></div>
        {orderTrackingLoading ? (
          <div style={{textAlign:'center', margin:'18px 0'}}>Loading...</div>
        ) : orderTrackingError ? (
          <div style={{color:'#ff4d5a', margin:'18px 0'}}>{orderTrackingError}</div>
        ) : orderTrackingOrder && (
          <div className="order-status-container">
            <div className="status-timeline">
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${currentStatus.progress}%` }}></div>
              </div>
              <p className="current-status-text">Status: <strong>{currentStatus.text}</strong></p>
            </div>
            {orderTrackingOrder.status === 'out_for_delivery' && deliveryLocation && (
              <div className="map-container">
                <h3>Live Delivery Map</h3>
                <MapContainer center={deliveryLocation} zoom={15} scrollWheelZoom={false} style={{ height: '300px', width: '100%' }}>
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
            {orderTrackingOrder.status === 'out_for_delivery' && !deliveryLocation && (
              <div className="delivery-info-placeholder">
                <p>Waiting for delivery person to start sharing their location...</p>
              </div>
            )}
            {(orderTrackingOrder.status !== 'out_for_delivery' && orderTrackingOrder.status !== 'delivered') && (
              <div className="delivery-info-placeholder">
                <p>Your order is being prepared. Live tracking will be available once the delivery starts.</p>
              </div>
            )}
          </div>
        )}
        <button
          onClick={() => setShowTrackingModal(false)}
          style={{background:'#ff4d5a', color:'#fff', border:'none', borderRadius:8, padding:'10px 28px', fontWeight:600, fontSize:'1.08rem', cursor:'pointer', marginTop:18}}
        >Close</button>
      </ReactModal>
    </div>
  );
} 