import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import './DeliveryPersonnelLogin.css';

const DeliveryPersonnelLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                throw error;
            }

            if (data.user) {
                navigate('/delivery-dashboard'); 
            }
        } catch (error) {
            setError(error.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="delivery-login-container">
            <div className="login-card">
                <h1 className="login-title">Delivery Personnel Login</h1>
                <p className="login-subtitle">Access your delivery dashboard</p>
                
                {error && <p className="error-message">{error}</p>}
                
                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                
                <div className="register-form-link" style={{ marginTop: '20px', textAlign: 'center' }}>
                    <Link to="/delivery-register">New delivery personnel? <span>Register here</span></Link>
                </div>
            </div>
        </div>
    );
};

export default DeliveryPersonnelLogin; 