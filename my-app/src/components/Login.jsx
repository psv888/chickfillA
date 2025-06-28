import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './Register.css';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import LoginSuccessAnimation from './LoginSuccessAnimation';

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [isLoginSuccess, setIsLoginSuccess] = useState(false);
    const navigate = useNavigate();

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
        // Use Supabase Auth for login
        const { data, error } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
        });
        if (error) {
            setError(error.message || 'Login failed.');
        } else if (data && data.user) {
            setIsLoginSuccess(true);
        } else {
            setError('Login failed.');
        }
    };

    const handleAnimationEnd = () => {
        navigate('/home');
    };

    if (isLoginSuccess) {
        return <LoginSuccessAnimation onAnimationEnd={handleAnimationEnd} />;
    }

    return (
        <div className="login-bg food-bg-animate">
            <div className="login-logo food-bounce" style={{ marginBottom: '12px', marginTop: '32px' }}>
                <DotLottieReact
                    src="/animations/login.lottie"
                    loop
                    autoplay
                    style={{ width: 180, height: 180 }}
                />
            </div>
            <form className="login-form" onSubmit={handleSubmit}>
                <h2 className="login-heading">Welcome Back</h2>
                <p className="login-subtitle">Sign in to your account</p>
                {error && <div className="login-error-message">{error}</div>}
                <div className="login-form-group left-align">
                    <label htmlFor="email">Email</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        autoComplete="username"
                        placeholder="Enter your email"
                    />
                </div>
                <div className="login-form-group left-align">
                    <label htmlFor="password">Password</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        autoComplete="current-password"
                        placeholder="Enter your password"
                    />
                </div>
                <button type="submit" className="login-btn">Login</button>
                <div className="login-form-link">
                    <Link to="/register">Don't have an account? <span>Register</span></Link>
                    <br />
                    <Link to="/admin-login">Login as Admin</Link>
                    <br />
                    <Link to="/delivery-login">Login as Delivery Boy</Link>
                </div>
            </form>
            {/* Floating food SVGs for login page background - positioned behind all content */}
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
            <svg className="food-float food-float-13" width="36" height="36" viewBox="0 0 36 36" fill="none">
                <ellipse cx="18" cy="18" rx="14" ry="14" fill="#FB923C" />
                <ellipse cx="18" cy="18" rx="10" ry="10" fill="#FED7AA" />
                <ellipse cx="18" cy="18" rx="6" ry="6" fill="#FB923C" />
            </svg>
            
            {/* Strawberry */}
            <svg className="food-float food-float-14" width="28" height="28" viewBox="0 0 28 28" fill="none">
                <ellipse cx="14" cy="18" rx="10" ry="6" fill="#F87171" />
                <ellipse cx="14" cy="16" rx="8" ry="4" fill="#FECACA" />
                <ellipse cx="14" cy="14" rx="6" ry="3" fill="#F87171" />
                <ellipse cx="14" cy="12" rx="4" ry="2" fill="#FECACA" />
                <ellipse cx="14" cy="10" rx="2" ry="1" fill="#F87171" />
                <rect x="13" y="6" width="2" height="4" rx="1" fill="#65A30D" />
            </svg>
            
            {/* Banana */}
            <svg className="food-float food-float-15" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <ellipse cx="12" cy="16" rx="8" ry="4" fill="#FDE68A" />
                <ellipse cx="12" cy="14" rx="6" ry="3" fill="#F59E42" />
                <ellipse cx="12" cy="12" rx="4" ry="2" fill="#FDE68A" />
                <ellipse cx="12" cy="10" rx="2" ry="1" fill="#F59E42" />
            </svg>
            
            {/* Grapes */}
            <svg className="food-float food-float-16" width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="20" r="6" fill="#A855F7" />
                <circle cx="12" cy="18" r="4" fill="#C084FC" />
                <circle cx="20" cy="18" r="4" fill="#C084FC" />
                <circle cx="14" cy="16" r="3" fill="#A855F7" />
                <circle cx="18" cy="16" r="3" fill="#A855F7" />
                <circle cx="16" cy="14" r="2" fill="#C084FC" />
                <rect x="15" y="8" width="2" height="6" rx="1" fill="#65A30D" />
            </svg>
            
            {/* Watermelon */}
            <svg className="food-float food-float-17" width="32" height="32" viewBox="0 0 32 32" fill="none">
                <ellipse cx="16" cy="20" rx="12" ry="6" fill="#F87171" />
                <ellipse cx="16" cy="20" rx="8" ry="4" fill="#FECACA" />
                <ellipse cx="16" cy="20" rx="4" ry="2" fill="#F87171" />
                <ellipse cx="16" cy="20" rx="2" ry="1" fill="#FECACA" />
            </svg>
            
            {/* Pineapple */}
            <svg className="food-float food-float-18" width="32" height="32" viewBox="0 0 32 32" fill="none">
                <ellipse cx="16" cy="20" rx="10" ry="6" fill="#FDE68A" />
                <ellipse cx="16" cy="18" rx="8" ry="4" fill="#F59E42" />
                <ellipse cx="16" cy="16" rx="6" ry="3" fill="#FDE68A" />
                <ellipse cx="16" cy="14" rx="4" ry="2" fill="#F59E42" />
                <ellipse cx="16" cy="12" rx="2" ry="1" fill="#FDE68A" />
                <rect x="15" y="6" width="2" height="6" rx="1" fill="#65A30D" />
            </svg>
            
            {/* Mango */}
            <svg className="food-float food-float-19" width="28" height="28" viewBox="0 0 28 28" fill="none">
                <ellipse cx="14" cy="18" rx="10" ry="6" fill="#FBBF24" />
                <ellipse cx="14" cy="16" rx="8" ry="4" fill="#FDE68A" />
                <ellipse cx="14" cy="14" rx="6" ry="3" fill="#F59E42" />
                <ellipse cx="14" cy="12" rx="4" ry="2" fill="#FBBF24" />
                <rect x="13" y="6" width="2" height="6" rx="1" fill="#65A30D" />
            </svg>
            
            {/* Papaya */}
            <svg className="food-float food-float-20" width="30" height="30" viewBox="0 0 30 30" fill="none">
                <ellipse cx="15" cy="18" rx="10" ry="6" fill="#FB923C" />
                <ellipse cx="15" cy="16" rx="8" ry="4" fill="#FED7AA" />
                <ellipse cx="15" cy="14" rx="6" ry="3" fill="#FB923C" />
                <ellipse cx="15" cy="12" rx="4" ry="2" fill="#FED7AA" />
                <ellipse cx="15" cy="10" rx="2" ry="1" fill="#FB923C" />
                <rect x="14" y="6" width="2" height="4" rx="1" fill="#65A30D" />
            </svg>
        </div>
    );
};

export default Login; 