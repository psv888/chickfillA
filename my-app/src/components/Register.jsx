import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './Register.css';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

// Helper: Get zipcode from location using Nominatim
async function getZipcodeFromLocation(location) {
    if (!location) return '';
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&addressdetails=1&limit=1`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.length > 0 && data[0].address && data[0].address.postcode) {
            return data[0].address.postcode;
        }
    } catch (e) {
        // ignore
    }
    return '';
}

// Helper: Get location suggestions from Nominatim
async function getLocationSuggestions(query) {
    if (!query) return [];
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data;
    } catch (e) {
        return [];
    }
}

const Register = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        phone: '',
        zipcode: ''
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const [location, setLocation] = useState('');
    const [locationSuggestions, setLocationSuggestions] = useState([]);
    const [showLocationDropdown, setShowLocationDropdown] = useState(false);
    const locationInputRef = useRef();
    let locationDebounceTimeout = useRef();
    const [autoZipLoading, setAutoZipLoading] = useState(false);
    const [autoZipError, setAutoZipError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate zipcode
        if (!formData.zipcode || !/^[0-9]{5,6}$/.test(formData.zipcode)) {
            setError('Please enter a valid 5-6 digit zipcode.');
            return;
        }

        // Register with Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
        });
        if (error) {
            setError(error.message || 'Registration failed.');
            return;
        }
        // Insert user profile into users table
        if (data && data.user) {
            const { error: profileError } = await supabase.from('users').insert([
                {
                    user_id: data.user.id, // use uuid from auth
                    email: formData.email,
                    name: formData.name,
                    phone: formData.phone,
                    zipcode: formData.zipcode,
                }
            ]);
            if (profileError) {
                setError('Profile creation failed: ' + profileError.message);
                return;
            }
            navigate('/login');
        } else {
            setError('Registration failed.');
        }
    };

    // Handler for location input change (with debounce)
    const handleLocationInputChange = async (e) => {
        const value = e.target.value;
        setLocation(value);
        setShowLocationDropdown(true);
        if (locationDebounceTimeout.current) clearTimeout(locationDebounceTimeout.current);
        locationDebounceTimeout.current = setTimeout(async () => {
            if (value.length < 2) {
                setLocationSuggestions([]);
                return;
            }
            const suggestions = await getLocationSuggestions(value);
            setLocationSuggestions(suggestions);
        }, 300);
    };

    // Handler for suggestion click
    const handleLocationSuggestionClick = (suggestion) => {
        setLocation(suggestion.display_name);
        setShowLocationDropdown(false);
        setLocationSuggestions([]);
        // Auto-fill zipcode if available
        if (suggestion.address && suggestion.address.postcode) {
            setFormData(prevState => ({
                ...prevState,
                zipcode: suggestion.address.postcode
            }));
        }
    };

    // Handler for blur (hide dropdown after a short delay)
    const handleLocationBlur = () => {
        setTimeout(() => setShowLocationDropdown(false), 200);
    };

    return (
        <div className="register-bg food-bg-animate">
            <div className="register-logo food-bounce" style={{ marginBottom: '12px', marginTop: '32px' }}>
                <DotLottieReact
                    src="/animations/register.lottie"
                    loop
                    autoplay
                    style={{ width: 180, height: 180 }}
                />
            </div>
            <form className="register-form" onSubmit={handleSubmit}>
                <h2 className="register-heading">Create Account</h2>
                <p className="login-subtitle">Sign up to get started</p>
                {error && <div className="register-error-message">{error}</div>}
                <div className="register-form-group left-align">
                    <label htmlFor="name">Name</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="Enter your name"
                    />
                </div>
                <div className="register-form-group left-align">
                    <label htmlFor="email">Email</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        placeholder="Enter your email"
                    />
                </div>
                <div className="register-form-group left-align">
                    <label htmlFor="phone">Phone</label>
                    <input
                        type="text"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        placeholder="Enter your phone number"
                    />
                </div>
                <div className="register-form-group left-align" ref={locationInputRef} style={{ position: 'relative' }}>
                    <label htmlFor="location">Location</label>
                    <input
                        type="text"
                        id="location"
                        name="location"
                        className="register-input"
                        value={location}
                        onChange={handleLocationInputChange}
                        onBlur={handleLocationBlur}
                        placeholder="Enter your city, state, country or street address"
                        required
                        autoComplete="off"
                        onFocus={() => location && setShowLocationDropdown(true)}
                    />
                    {showLocationDropdown && locationSuggestions.length > 0 && (
                        <ul className="location-suggestions-dropdown" style={{
                            position: 'absolute',
                            zIndex: 10,
                            background: '#fff',
                            border: '1px solid #eee',
                            width: '100%',
                            maxHeight: 180,
                            overflowY: 'auto',
                            listStyle: 'none',
                            margin: 0,
                            padding: 0,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                        }}>
                            {locationSuggestions.map((s, idx) => (
                                <li
                                    key={s.place_id}
                                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f3f3' }}
                                    onMouseDown={() => handleLocationSuggestionClick(s)}
                                >
                                    {s.display_name}
                                </li>
                            ))}
                        </ul>
                    )}
                    {autoZipLoading && <div style={{ color: '#1a73e8', fontSize: '0.95rem', marginTop: 2 }}>Detecting zipcode...</div>}
                    {autoZipError && <div style={{ color: '#d73748', fontSize: '0.95rem', marginTop: 2 }}>{autoZipError}</div>}
                </div>
                <div className="register-form-group left-align">
                    <label htmlFor="zipcode">Zip Code</label>
                    <input
                        type="text"
                        id="zipcode"
                        name="zipcode"
                        value={formData.zipcode}
                        onChange={handleChange}
                        required
                        placeholder="Enter your zip code"
                        maxLength="6"
                        pattern="[0-9]{5,6}"
                    />
                    <small style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        We'll show you restaurants and food available in your area
                    </small>
                </div>
                <div className="register-form-group left-align">
                    <label htmlFor="password">Password</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        placeholder="Create a password"
                    />
                </div>
                <button type="submit" className="register-btn">Register</button>
                <div className="register-form-link">
                    <Link to="/login">Already have an account? <span>Login</span></Link>
                </div>
            </form>
            {/* 15 floating food SVGs for background, same as login page */}
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
        </div>
    );
};

export default Register; 