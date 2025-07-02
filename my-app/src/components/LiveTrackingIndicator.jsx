import React from 'react';
import { useLocationTracking } from '../contexts/LocationTrackingContext';
import './LiveTrackingIndicator.css';

const LiveTrackingIndicator = () => {
  const { isTracking, trackingOrders, currentLocation } = useLocationTracking();

  if (!isTracking) {
    return null;
  }

  return (
    <div className="live-tracking-indicator">
      <div className="tracking-content">
        <div className="tracking-icon">
          <div className="pulse-dot"></div>
          <span>📍</span>
        </div>
        <div className="tracking-info">
          <div className="tracking-title">Live Tracking Active</div>
          <div className="tracking-details">
            {trackingOrders.length > 0 ? (
              <>
                <span>{trackingOrders.length} order{trackingOrders.length > 1 ? 's' : ''} being tracked</span>
                {currentLocation && (
                  <span className="location-coords">
                    {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
                  </span>
                )}
              </>
            ) : (
              <span>No active deliveries</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTrackingIndicator; 