import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './DeliveryPersonnelLogin.css';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const DeliveryPersonnelRegister = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
        phone_number: '',
        vehicle_details: '',
        zipcode: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
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
        setLoading(true);

        // Validate zipcode is a number and 5-6 digits
        if (!/^[0-9]{5,6}$/.test(formData.zipcode)) {
            setError('Zip code must be a 5 or 6 digit number.');
            setLoading(false);
            return;
        }

        try {
            // Register with Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
            });

            if (error) {
                throw error;
            }

            // Insert delivery personnel profile into delivery_personnel table
            if (data && data.user) {
                const { error: profileError } = await supabase.from('delivery_personnel').insert([
                    {
                        user_id: data.user.id,
                        full_name: formData.full_name,
                        phone_number: formData.phone_number,
                        vehicle_details: formData.vehicle_details,
                        zipcode: parseInt(formData.zipcode, 10),
                        created_at: new Date().toISOString()
                    }
                ]);

                if (profileError) {
                    throw new Error('Profile creation failed: ' + profileError.message);
                }

                navigate('/delivery-login');
            } else {
                throw new Error('Registration failed.');
            }
        } catch (error) {
            setError(error.message || 'Registration failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="delivery-login-container">
            <div className="login-card">
                <div className="register-logo" style={{ marginBottom: '12px', marginTop: '32px', textAlign: 'center' }}>
                    <DotLottieReact
                        src="/animations/delivery boy.lottie"
                        loop
                        autoplay
                        style={{ width: 120, height: 120 }}
                    />
                </div>
                <h1 className="login-title">Delivery Personnel Registration</h1>
                <p className="login-subtitle">Join our delivery team</p>
                
                {error && <p className="error-message">{error}</p>}
                
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="full_name">Full Name</label>
                        <input
                            id="full_name"
                            name="full_name"
                            type="text"
                            placeholder="Enter your full name"
                            value={formData.full_name}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="Enter your email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="phone_number">Phone Number</label>
                        <input
                            id="phone_number"
                            name="phone_number"
                            type="tel"
                            placeholder="Enter your phone number"
                            value={formData.phone_number}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="vehicle_details">Vehicle Details</label>
                        <input
                            id="vehicle_details"
                            name="vehicle_details"
                            type="text"
                            placeholder="e.g. Honda-2222"
                            value={formData.vehicle_details}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="zipcode">Zip Code</label>
                        <input
                            id="zipcode"
                            name="zipcode"
                            type="text"
                            placeholder="Enter your zip code"
                            value={formData.zipcode}
                            onChange={handleChange}
                            required
                            pattern="[0-9]{5,6}"
                            title="Please enter a valid 5 or 6 digit zip code"
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Create a password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            minLength="6"
                        />
                    </div>
                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? 'Creating Account...' : 'Register'}
                    </button>
                </form>
                
                <div className="register-form-link" style={{ marginTop: '20px', textAlign: 'center' }}>
                    <Link to="/delivery-login">Already have an account? <span>Login</span></Link>
                </div>
            </div>
        </div>
    );
};

export default DeliveryPersonnelRegister; 