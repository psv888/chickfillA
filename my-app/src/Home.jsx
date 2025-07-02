import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';
import Modal from 'react-modal';
import './Home.css';
import Navbar from './components/Navbar';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import './components/LoginSuccessAnimation.css';
import { getUserLocation, getLatLngFromZip, getDistanceKm } from './utils/locationFiltering';
import RestaurantCard from './components/RestaurantCard';

const sections = [
    { key: 'restaurants', label: 'Restaurants', icon: '🍽️' },
    { key: 'biryani', label: 'Biryani Points', icon: '🍚' },
    { key: 'pickles', label: 'Pickles', icon: '🥒' },
    { key: 'tiffins', label: 'Tiffins', icon: '🥘' },
    { key: 'fresh-meat', label: 'Fresh Meat', icon: '🥩' },
];

const carouselImages = [
    // Biryani
    'https://images.pexels.com/photos/769969/pexels-photo-769969.jpeg',

    'https://images.pexels.com/photos/941869/pexels-photo-941869.jpeg',
    // Pickle
    'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=800&q=80',
    // Fried Rice
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    // Restaurant
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80'
];

// Mock dish previews for restaurants
const mockDishes = [
    {
        name: 'Paneer Butter Masala',
        photo_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    },
    {
        name: 'Chicken Biryani',
        photo_url: 'https://images.unsplash.com/photo-1600628422019-6c3d1b6c9a9e?auto=format&fit=crop&w=400&q=80',
    },
    {
        name: 'Masala Dosa',
        photo_url: 'https://images.unsplash.com/photo-1519864600265-abb23847ef2c?auto=format&fit=crop&w=400&q=80',
    },
];

const Home = () => {
    const [current, setCurrent] = React.useState(0);
    const [items, setItems] = useState({
        restaurants: [],
        biryani: [],
        pickles: [],
        tiffins: [],
        'fresh-meat': [],
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const navigate = useNavigate();
    const [userZipcode, setUserZipcode] = useState(null);

    useEffect(() => {
        const fetchItems = async () => {
            // Get user's zipcode
            const userZip = await getUserLocation();
            setUserZipcode(userZip);
            const { data, error } = await supabase
                .from('admin_items')
                .select('*');
            if (error) return;
            const grouped = { restaurants: [], biryani: [], pickles: [], tiffins: [], 'fresh-meat': [] };
            if (!userZip) {
                // No user zipcode, show all
                data.forEach(item => {
                    if (grouped[item.section]) grouped[item.section].push(item);
                });
                setItems(grouped);
                return;
            }
            // Geocode user zipcode only
            const userLatLng = await getLatLngFromZip(userZip);
            if (!userLatLng) {
                // Could not geocode user, show all
                data.forEach(item => {
                    if (grouped[item.section]) grouped[item.section].push(item);
                });
                setItems(grouped);
                return;
            }
            // Filter each section by distance using stored lat/lng
            for (const section of Object.keys(grouped)) {
                const sectionItems = data.filter(item => item.section === section);
                grouped[section] = sectionItems.filter(item => {
                    if (item.latitude == null || item.longitude == null) {
                        // If no lat/lng, skip
                        return false;
                    }
                    const dist = getDistanceKm(userLatLng.lat, userLatLng.lon, item.latitude, item.longitude);
                    item.distance = dist;
                    return dist <= 10;
                });
                // Sort by distance
                grouped[section].sort((a, b) => (a.distance || 0) - (b.distance || 0));
            }
            setItems(grouped);
        };
        fetchItems();
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % carouselImages.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const goToPrev = () => {
        setCurrent((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);
    };

    const goToNext = () => {
        setCurrent((prev) => (prev + 1) % carouselImages.length);
    };

    const openModal = (item, section) => {
        setSelectedItem({ ...item, section });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedItem(null);
    };

    const handleItemClick = (item, section) => {
        if (section === 'restaurants' || section === 'biryani') {
            openModal(item, section);
        } else {
            navigate(`/${section}`);
        }
    };

    return (
        <div className="home-container food-bg-animate">
            <Navbar 
              searchQuery={searchQuery}
              onSearchChange={(e) => setSearchQuery(e.target.value)}
            />
            <video className="bg-video" autoPlay loop muted playsInline>
                <source src="https://videos.pexels.com/video-files/6894472/6894472-hd_1920_1080_25fps.mp4" type="video/mp4" />
                Your browser does not support the video tag.
            </video>

            <div className="carousel-container">
                <div className="carousel">
                    <button className="carousel-arrow left" onClick={goToPrev}>❮</button>
                    <div className="carousel-track" style={{
                        display: 'flex',
                        width: `calc(100% * ${carouselImages.length})`,
                        transform: `translateX(-${current * 100}%)`,
                        transition: 'transform 0.7s cubic-bezier(.68,-0.55,.27,1.55)'
                        
                    }}>
                        {carouselImages.filter(Boolean).map((img, idx) => (
                            <img
                                key={idx}
                                src={img}
                                alt="carousel"
                                className="carousel-slide"
                                style={{ width: '100%', flexShrink: 0, objectFit: 'cover', borderRadius: '22px' }}
                                onError={e => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80'; }}
                            />
                        ))}
                    </div>
                    <button className="carousel-arrow right" onClick={goToNext}>❯</button>
                </div>
                <div className="carousel-dots">
                    {carouselImages.map((_, idx) => (
                        <span 
                            key={idx} 
                            className={`dot ${idx === current ? 'active' : ''}`}
                            onClick={() => setCurrent(idx)}
                        />
                    ))}
                </div>
            </div>

            <div className="quick-categories">
                {sections.map((section) => (
                    <div
                        key={section.key}
                        className="category-card clickable"
                        onClick={() => navigate(`/${section.key}`)}
                        tabIndex={0}
                        role="button"
                        aria-label={section.label}
                        onKeyDown={e => { if (e.key === 'Enter') navigate(`/${section.key}`); }}
                    >
                        <span className="category-icon">{section.icon}</span>
                        <span className="category-label">{section.label}</span>
                    </div>
                ))}
            </div>

            <div className="home-sections">
                {sections.map((s) => (
                    <div key={s.key} className="home-section">
                        <div className="section-header">
                            <h3>{s.label}</h3>
                            <button className="view-all-btn" onClick={() => navigate(`/${s.key}`)}>View All</button>
                        </div>
                        <div className="category-cards-grid">
                            {items[s.key].length === 0 && (
                                <div className="no-items-message">
                                    <span className="no-items-icon">🍽️</span>
                                    <span>No {s.label.toLowerCase()} found near you.</span>
                                </div>
                            )}
                            {items[s.key].map((item, idx) => (
                                <RestaurantCard
                                    key={item.id || idx}
                                    restaurant={item}
                                    onCardClick={() => handleItemClick(item, s.key)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            {/* Floating food SVGs for home page background - positioned behind all content */}
            {/* Donut */}
            <svg className="food-float food-float-1" width="48" height="48" viewBox="0 0 48 48" fill="none" style={{zIndex: -1}}>
                <ellipse cx="24" cy="24" rx="20" ry="20" fill="#FDE68A" />
                <ellipse cx="24" cy="24" rx="14" ry="14" fill="#fff" />
                <ellipse cx="24" cy="24" rx="8" ry="8" fill="#F59E42" />
                <circle cx="24" cy="24" r="3" fill="#fff" />
                <path d="M18 18 Q24 20 30 18" stroke="#F59E42" strokeWidth="2" fill="none" />
                <path d="M18 30 Q24 28 30 30" stroke="#F59E42" strokeWidth="2" fill="none" />
            </svg>
            
            {/* Pizza Slice */}
            <svg className="food-float food-float-2" width="44" height="44" viewBox="0 0 44 44" fill="none" style={{zIndex: -1}}>
                <path d="M22 6 L38 38 Q22 44 6 38 Z" fill="#FFD966" stroke="#B45309" strokeWidth="2" />
                <ellipse cx="22" cy="32" rx="10" ry="4" fill="#F59E42" />
                <circle cx="16" cy="28" r="2" fill="#B91C1C" />
                <circle cx="28" cy="30" r="2" fill="#B91C1C" />
                <circle cx="22" cy="36" r="1.5" fill="#B91C1C" />
            </svg>
            
            {/* Chicken Leg Piece */}
            <svg className="food-float food-float-3" width="40" height="40" viewBox="0 0 40 40" fill="none" style={{zIndex: -1}}>
                <ellipse cx="20" cy="28" rx="12" ry="6" fill="#F59E42" />
                <ellipse cx="20" cy="24" rx="10" ry="4" fill="#FDE68A" />
                <ellipse cx="20" cy="20" rx="8" ry="3" fill="#F59E42" />
                <ellipse cx="20" cy="16" rx="6" ry="2" fill="#FDE68A" />
                <ellipse cx="20" cy="12" rx="4" ry="1.5" fill="#F59E42" />
                <ellipse cx="20" cy="8" rx="2" ry="1" fill="#FDE68A" />
            </svg>
            
            {/* Ice Cream Cone */}
            <svg className="food-float food-float-4" width="38" height="38" viewBox="0 0 38 38" fill="none" style={{zIndex: -1}}>
                <ellipse cx="19" cy="22" rx="10" ry="6" fill="#FBBF24" />
                <ellipse cx="19" cy="18" rx="8" ry="4" fill="#F59E42" />
                <ellipse cx="19" cy="14" rx="6" ry="3" fill="#F87171" />
                <ellipse cx="19" cy="10" rx="4" ry="2" fill="#A78BFA" />
                <rect x="15" y="22" width="8" height="10" rx="2" fill="#FDE68A" />
                <ellipse cx="19" cy="32" rx="6" ry="2" fill="#F59E42" />
            </svg>
            
            {/* Burger */}
            <svg className="food-float food-float-5" width="36" height="36" viewBox="0 0 36 36" fill="none" style={{zIndex: -1}}>
                <ellipse cx="18" cy="13" rx="15" ry="6" fill="#FFD966" stroke="#B45309" strokeWidth="1.5"/>
                <rect x="6" y="18" width="24" height="8" rx="4" fill="#F59E42" stroke="#B45309" strokeWidth="1.5"/>
                <ellipse cx="18" cy="28" rx="12" ry="4" fill="#A3E635" stroke="#15803D" strokeWidth="1.5"/>
            </svg>
            
            {/* French Fries */}
            <svg className="food-float food-float-6" width="32" height="32" viewBox="0 0 32 32" fill="none" style={{zIndex: -1}}>
                <rect x="12" y="8" width="8" height="16" rx="2" fill="#FDE68A" />
                <rect x="10" y="10" width="2" height="12" rx="1" fill="#F59E42" />
                <rect x="20" y="10" width="2" height="12" rx="1" fill="#F59E42" />
                <rect x="14" y="12" width="4" height="8" rx="1" fill="#F59E42" />
                <ellipse cx="16" cy="24" rx="6" ry="2" fill="#FDE68A"/>
            </svg>
            
            {/* Hot Dog */}
            <svg className="food-float food-float-7" width="32" height="32" viewBox="0 0 32 32" fill="none" style={{zIndex: -1}}>
                <ellipse cx="16" cy="16" rx="12" ry="4" fill="#F59E42" />
                <ellipse cx="16" cy="16" rx="8" ry="2" fill="#FDE68A" />
                <ellipse cx="16" cy="16" rx="4" ry="1" fill="#F59E42" />
            </svg>
            
            {/* Sushi */}
            <svg className="food-float food-float-8" width="28" height="28" viewBox="0 0 28 28" fill="none" style={{zIndex: -1}}>
                <ellipse cx="14" cy="18" rx="10" ry="4" fill="#FDE68A" />
                <ellipse cx="14" cy="16" rx="8" ry="3" fill="#F59E42" />
                <ellipse cx="14" cy="14" rx="6" ry="2" fill="#FDE68A" />
                <ellipse cx="14" cy="12" rx="4" ry="1.5" fill="#F59E42" />
            </svg>
            
            {/* Taco */}
            <svg className="food-float food-float-9" width="30" height="30" viewBox="0 0 30 30" fill="none" style={{zIndex: -1}}>
                <ellipse cx="15" cy="20" rx="12" ry="6" fill="#FDE68A" />
                <ellipse cx="15" cy="18" rx="10" ry="4" fill="#F59E42" />
                <ellipse cx="15" cy="16" rx="8" ry="3" fill="#A3E635" />
                <ellipse cx="15" cy="14" rx="6" ry="2" fill="#F87171" />
            </svg>
            
            {/* Cupcake */}
            <svg className="food-float food-float-10" width="26" height="26" viewBox="0 0 26 26" fill="none" style={{zIndex: -1}}>
                <ellipse cx="13" cy="18" rx="8" ry="3" fill="#FDE68A"/>
                <ellipse cx="13" cy="15" rx="6" ry="2" fill="#fff"/>
                <ellipse cx="13" cy="12" rx="4" ry="1.5" fill="#F59E42"/>
                <ellipse cx="13" cy="9" rx="3" ry="1" fill="#B91C1C"/>
            </svg>
            
            {/* Croissant */}
            <svg className="food-float food-float-11" width="24" height="24" viewBox="0 0 24 24" fill="none" style={{zIndex: -1}}>
                <ellipse cx="12" cy="12" rx="10" ry="5" fill="#FDE68A" stroke="#F59E42" strokeWidth="1.5"/>
                <ellipse cx="12" cy="12" rx="6" ry="2" fill="#F59E42" />
            </svg>
            
            {/* Apple */}
            <svg className="food-float food-float-12" width="22" height="22" viewBox="0 0 22 22" fill="none" style={{zIndex: -1}}>
                <ellipse cx="11" cy="14" rx="8" ry="6" fill="#F87171" />
                <ellipse cx="11" cy="14" rx="4" ry="3" fill="#FECACA" />
                <rect x="10" y="6" width="2" height="4" rx="1" fill="#65A30D" />
                <ellipse cx="11" cy="6" rx="1.5" ry="0.8" fill="#A3E635" />
            </svg>
            
            {/* Orange */}
            <svg className="food-float food-float-13" width="36" height="36" viewBox="0 0 36 36" fill="none" style={{zIndex: -1}}>
                <ellipse cx="18" cy="18" rx="14" ry="14" fill="#FB923C" />
                <ellipse cx="18" cy="18" rx="10" ry="10" fill="#FED7AA" />
                <ellipse cx="18" cy="18" rx="6" ry="6" fill="#FB923C" />
            </svg>
            
            {/* Strawberry */}
            <svg className="food-float food-float-14" width="28" height="28" viewBox="0 0 28 28" fill="none" style={{zIndex: -1}}>
                <ellipse cx="14" cy="18" rx="10" ry="6" fill="#F87171" />
                <ellipse cx="14" cy="16" rx="8" ry="4" fill="#FECACA" />
                <ellipse cx="14" cy="14" rx="6" ry="3" fill="#F87171" />
                <ellipse cx="14" cy="12" rx="4" ry="2" fill="#FECACA" />
                <ellipse cx="14" cy="10" rx="2" ry="1" fill="#F87171" />
                <rect x="13" y="6" width="2" height="4" rx="1" fill="#65A30D" />
            </svg>
            
            {/* Banana */}
            <svg className="food-float food-float-15" width="24" height="24" viewBox="0 0 24 24" fill="none" style={{zIndex: -1}}>
                <ellipse cx="12" cy="16" rx="8" ry="4" fill="#FDE68A" />
                <ellipse cx="12" cy="14" rx="6" ry="3" fill="#F59E42" />
                <ellipse cx="12" cy="12" rx="4" ry="2" fill="#FDE68A" />
                <ellipse cx="12" cy="10" rx="2" ry="1" fill="#F59E42" />
            </svg>
            
            {/* Grapes */}
            <svg className="food-float food-float-16" width="32" height="32" viewBox="0 0 32 32" fill="none" style={{zIndex: -1}}>
                <circle cx="16" cy="20" r="6" fill="#A855F7" />
                <circle cx="12" cy="18" r="4" fill="#C084FC" />
                <circle cx="20" cy="18" r="4" fill="#C084FC" />
                <circle cx="14" cy="16" r="3" fill="#A855F7" />
                <circle cx="18" cy="16" r="3" fill="#A855F7" />
                <circle cx="16" cy="14" r="2" fill="#C084FC" />
                <rect x="15" y="8" width="2" height="6" rx="1" fill="#65A30D" />
            </svg>
            
            {/* Watermelon */}
            <svg className="food-float food-float-17" width="32" height="32" viewBox="0 0 32 32" fill="none" style={{zIndex: -1}}>
                <ellipse cx="16" cy="20" rx="12" ry="6" fill="#F87171" />
                <ellipse cx="16" cy="20" rx="8" ry="4" fill="#FECACA" />
                <ellipse cx="16" cy="20" rx="4" ry="2" fill="#F87171" />
                <ellipse cx="16" cy="20" rx="2" ry="1" fill="#FECACA" />
            </svg>
            
            {/* Pineapple */}
            <svg className="food-float food-float-18" width="32" height="32" viewBox="0 0 32 32" fill="none" style={{zIndex: -1}}>
                <ellipse cx="16" cy="20" rx="10" ry="6" fill="#FDE68A" />
                <ellipse cx="16" cy="18" rx="8" ry="4" fill="#F59E42" />
                <ellipse cx="16" cy="16" rx="6" ry="3" fill="#FDE68A" />
                <ellipse cx="16" cy="14" rx="4" ry="2" fill="#F59E42" />
                <ellipse cx="16" cy="12" rx="2" ry="1" fill="#FDE68A" />
                <rect x="15" y="6" width="2" height="6" rx="1" fill="#65A30D" />
            </svg>
            
            {/* Mango */}
            <svg className="food-float food-float-19" width="28" height="28" viewBox="0 0 28 28" fill="none" style={{zIndex: -1}}>
                <ellipse cx="14" cy="18" rx="10" ry="6" fill="#FBBF24" />
                <ellipse cx="14" cy="16" rx="8" ry="4" fill="#FDE68A" />
                <ellipse cx="14" cy="14" rx="6" ry="3" fill="#F59E42" />
                <ellipse cx="14" cy="12" rx="4" ry="2" fill="#FBBF24" />
                <rect x="13" y="6" width="2" height="6" rx="1" fill="#65A30D" />
            </svg>
            
            {/* Papaya */}
            <svg className="food-float food-float-20" width="30" height="30" viewBox="0 0 30 30" fill="none" style={{zIndex: -1}}>
                <ellipse cx="15" cy="18" rx="10" ry="6" fill="#FB923C" />
                <ellipse cx="15" cy="16" rx="8" ry="4" fill="#FED7AA" />
                <ellipse cx="15" cy="14" rx="6" ry="3" fill="#FB923C" />
                <ellipse cx="15" cy="12" rx="4" ry="2" fill="#FED7AA" />
                <ellipse cx="15" cy="10" rx="2" ry="1" fill="#FB923C" />
                <rect x="14" y="6" width="2" height="4" rx="1" fill="#65A30D" />
            </svg>

            {/* Restaurant/Biryani Modal */}
            <Modal
                isOpen={isModalOpen}
                onRequestClose={closeModal}
                className="restaurant-modal"
                overlayClassName="restaurant-modal-overlay"
                contentLabel="Restaurant Details"
            >
                {selectedItem && (
                    <div className="modal-content">
                        <button className="modal-close-btn" onClick={closeModal}>×</button>
                        <div className="modal-header">
                            <img 
                                src={selectedItem.photo_url} 
                                alt={selectedItem.name} 
                                className="modal-restaurant-image"
                            />
                            <div className="modal-restaurant-info">
                                <h2 className="modal-restaurant-name">{selectedItem.name}</h2>
                                <p className="modal-restaurant-location">{selectedItem.location}</p>
                                <div className="modal-restaurant-rating">
                                    <span className="rating-star">★</span>
                                    <span className="rating-text">4.2 (150+ reviews)</span>
                                </div>
                                <div className="modal-restaurant-meta">
                                    <span className="delivery-time">🕒 30-35 min</span>
                                    <span className="delivery-fee">🚚 ₹40 delivery fee</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="modal-body">
                            <div className="modal-section">
                                <h3>Popular Dishes</h3>
                                <div className="popular-dishes">
                                    {mockDishes.map((dish, idx) => (
                                        <div key={idx} className="dish-card">
                                            <img src={dish.photo_url} alt={dish.name} className="dish-image" />
                                            <div className="dish-info">
                                                <h4>{dish.name}</h4>
                                                <p className="dish-price">₹{Math.floor(Math.random() * 200) + 100}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="modal-section">
                                <h3>About {selectedItem.name}</h3>
                                <p className="restaurant-description">
                                    {selectedItem.section === 'restaurants' 
                                        ? `Experience the finest dining at ${selectedItem.name}. Our chefs create authentic dishes using the freshest ingredients. From traditional favorites to modern culinary innovations, we bring you the best flavors in town.`
                                        : `Discover the authentic taste of biryani at ${selectedItem.name}. Our biryani is prepared with premium basmati rice, aromatic spices, and tender meat, slow-cooked to perfection. Each bite is a celebration of traditional flavors.`
                                    }
                                </p>
                            </div>
                            
                            <div className="modal-actions">
                                <button 
                                    className="cancel-btn"
                                    onClick={closeModal}
                                >
                                    Cancel
                                </button>
                                <button 
                                    className="view-menu-btn"
                                    onClick={() => {
                                        closeModal();
                                        navigate(`/${selectedItem.section}`);
                                    }}
                                >
                                    View Full Menu
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Home; 