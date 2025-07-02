import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { supabase } from '../supabaseClient';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const MapDebug = () => {
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState({});

  const testOrder = async () => {
    if (!orderId.trim()) return;
    
    setLoading(true);
    setError('');
    setDebugInfo({});

    try {
      console.log('Testing order ID:', orderId);
      
      // Test 1: Check if function exists
      const { data: functionExists, error: functionError } = await supabase
        .rpc('get_order_with_geojson_location', { order_id_param: parseInt(orderId) });
      
      console.log('Function call result:', { functionExists, functionError });
      
      if (functionError) {
        setError(`Database function error: ${functionError.message}`);
        setDebugInfo({ functionError: functionError.message });
        return;
      }

      if (!functionExists) {
        setError('Order not found');
        setDebugInfo({ orderFound: false });
        return;
      }

      setOrder(functionExists);
      setDebugInfo({
        orderFound: true,
        orderStatus: functionExists.status,
        hasDeliveryPerson: !!functionExists.delivery_person_id,
        hasLocation: !!functionExists.delivery_person_location,
        locationData: functionExists.delivery_person_location
      });

      console.log('Order data:', functionExists);
      console.log('Location data:', functionExists.delivery_person_location);

    } catch (err) {
      console.error('Test error:', err);
      setError(`Test error: ${err.message}`);
      setDebugInfo({ testError: err.message });
    } finally {
      setLoading(false);
    }
  };

  const parseLocation = (locationGeoJSON) => {
    if (!locationGeoJSON || locationGeoJSON.type !== 'Point' || !locationGeoJSON.coordinates) {
      console.log('Invalid location data:', locationGeoJSON);
      return null;
    }
    const [lon, lat] = locationGeoJSON.coordinates;
    console.log('Parsed location:', [lat, lon]);
    return [lat, lon];
  };

  const deliveryLocation = parseLocation(order?.delivery_person_location);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Map Debug Component</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <input
          type="number"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="Enter Order ID"
          style={{ padding: '8px', marginRight: '10px' }}
        />
        <button onClick={testOrder} disabled={loading}>
          {loading ? 'Testing...' : 'Test Order'}
        </button>
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}

      {Object.keys(debugInfo).length > 0 && (
        <div style={{ 
          background: '#f5f5f5', 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          <h3>Debug Info:</h3>
          <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
        </div>
      )}

      {order && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Order Details:</h3>
          <p><strong>ID:</strong> {order.id}</p>
          <p><strong>Status:</strong> {order.status}</p>
          <p><strong>Delivery Person ID:</strong> {order.delivery_person_id || 'None'}</p>
          <p><strong>Has Location:</strong> {deliveryLocation ? 'Yes' : 'No'}</p>
          {deliveryLocation && (
            <p><strong>Location:</strong> {deliveryLocation.join(', ')}</p>
          )}
        </div>
      )}

      {order && order.status === 'out_for_delivery' && deliveryLocation && (
        <div style={{ border: '2px solid #4CAF50', borderRadius: '8px', padding: '10px' }}>
          <h3>✅ Map Should Display</h3>
          <div style={{ height: '400px', width: '100%' }}>
            <MapContainer 
              center={deliveryLocation} 
              zoom={15} 
              scrollWheelZoom={false}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={deliveryLocation}>
                <Popup>The delivery is here!</Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      )}

      {order && order.status === 'out_for_delivery' && !deliveryLocation && (
        <div style={{ 
          border: '2px solid #FF9800', 
          borderRadius: '8px', 
          padding: '10px',
          background: '#FFF3E0'
        }}>
          <h3>⚠️ Map Cannot Display</h3>
          <p>Order is out for delivery but no location data is available.</p>
          <p>This could mean:</p>
          <ul>
            <li>Delivery person hasn't started location tracking</li>
            <li>Location tracking failed</li>
            <li>Database function is not working correctly</li>
          </ul>
        </div>
      )}

      {order && order.status !== 'out_for_delivery' && (
        <div style={{ 
          border: '2px solid #2196F3', 
          borderRadius: '8px', 
          padding: '10px',
          background: '#E3F2FD'
        }}>
          <h3>ℹ️ Map Not Available</h3>
          <p>Order status is "{order.status}". Map will only show when status is "out_for_delivery".</p>
        </div>
      )}
    </div>
  );
};

export default MapDebug; 