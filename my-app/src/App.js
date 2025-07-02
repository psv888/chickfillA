import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Register from './components/Register';
import Login from './components/Login';
import Home from './Home';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import RestaurantsPage from './components/RestaurantsPage';
import BiryaniPage from './components/BiryaniPage';
import PicklesPage from './components/PicklesPage';
import TiffinsPage from './components/TiffinsPage';
import FreshMeatPage from './components/FreshMeatPage';
import ParentMenuPage from './components/ParentMenuPage';
import { CartProvider } from './CartContext';
import { LocationTrackingProvider } from './contexts/LocationTrackingContext';
import LiveTrackingIndicator from './components/LiveTrackingIndicator';
import AdminOrderManagement from './components/AdminOrderManagement';
import DeliveryPersonnelLogin from './components/DeliveryPersonnelLogin';
import DeliveryPersonnelRegister from './components/DeliveryPersonnelRegister';
import DeliveryDashboard from './components/DeliveryDashboard';
import OrderTracking from './components/OrderTracking';
import MapDebug from './components/MapDebug';
import './App.css';

function App() {
  return (
    <CartProvider>
      <LocationTrackingProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/home" element={<Home />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/admin-home" element={<AdminDashboard />} />
              <Route path="/admin-orders" element={<AdminOrderManagement />} />
              <Route path="/delivery-login" element={<DeliveryPersonnelLogin />} />
              <Route path="/delivery-register" element={<DeliveryPersonnelRegister />} />
              <Route path="/delivery-dashboard" element={<DeliveryDashboard />} />
              <Route path="/restaurants" element={<RestaurantsPage />} />
              <Route path="/biryani" element={<BiryaniPage />} />
              <Route path="/pickles" element={<PicklesPage />} />
              <Route path="/tiffins" element={<TiffinsPage />} />
              <Route path="/fresh-meat" element={<FreshMeatPage />} />
              <Route path="/parent/:id" element={<ParentMenuPage />} />
              <Route path="/order-tracking" element={<OrderTracking />} />
              <Route path="/map-debug" element={<MapDebug />} />
            </Routes>
            <LiveTrackingIndicator />
          </div>
        </Router>
      </LocationTrackingProvider>
    </CartProvider>
  );
}

export default App;