import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const LocationTrackingContext = createContext();

export const useLocationTracking = () => {
  const context = useContext(LocationTrackingContext);
  if (!context) {
    throw new Error('useLocationTracking must be used within a LocationTrackingProvider');
  }
  return context;
};

export const LocationTrackingProvider = ({ children }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [trackingOrders, setTrackingOrders] = useState([]);
  const [deliveryPersonId, setDeliveryPersonId] = useState(null);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);

  // Update location for all active delivery orders
  const updateLocationForOrders = useCallback(async (latitude, longitude) => {
    if (!deliveryPersonId || trackingOrders.length === 0 || !latitude || !longitude) return;

    const location = `POINT(${longitude} ${latitude})`;
    
    try {
      // Update location for all tracking orders
      const { error } = await supabase
        .from('orders')
        .update({ delivery_person_location: location })
        .in('id', trackingOrders.map(order => order.id));

      if (error) {
        console.error('Error updating location for orders:', error);
      } else {
        console.log(`Location updated for ${trackingOrders.length} orders`);
      }
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  }, [deliveryPersonId, trackingOrders]);

  // Start live location tracking
  const startTracking = useCallback(async (personId) => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported');
      return false;
    }

    if (isTracking) {
      console.log('Location tracking already active');
      return true;
    }

    try {
      // Get current location first
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      setCurrentLocation({ latitude, longitude });

      // Start watching position
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ latitude, longitude });
          
          // Update location for all tracking orders
          updateLocationForOrders(latitude, longitude);
        },
        (error) => {
          console.error('Location tracking error:', error);
          setIsTracking(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );

      setDeliveryPersonId(personId);
      setIsTracking(true);
      console.log('Live location tracking started');

      return true;
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      return false;
    }
  }, [isTracking, updateLocationForOrders]);

  // Stop live location tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsTracking(false);
    setCurrentLocation(null);
    setTrackingOrders([]);
    setDeliveryPersonId(null);
    console.log('Live location tracking stopped');
  }, []);

  // Add order to tracking list
  const addOrderToTracking = useCallback((order) => {
    setTrackingOrders(prev => {
      const exists = prev.find(o => o.id === order.id);
      if (!exists) {
        return [...prev, order];
      }
      return prev;
    });
  }, []);

  // Remove order from tracking list
  const removeOrderFromTracking = useCallback((orderId) => {
    setTrackingOrders(prev => prev.filter(order => order.id !== orderId));
  }, []);

  // Poll for active delivery orders
  const pollActiveOrders = useCallback(async () => {
    if (!deliveryPersonId) return;

    try {
      const { data: activeOrders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('delivery_person_id', deliveryPersonId)
        .eq('status', 'out_for_delivery');

      if (error) {
        console.error('Error fetching active orders:', error);
        return;
      }

      setTrackingOrders(activeOrders || []);
    } catch (error) {
      console.error('Failed to poll active orders:', error);
    }
  }, [deliveryPersonId]);

  // Start polling for active orders when tracking is active
  useEffect(() => {
    if (isTracking && deliveryPersonId) {
      // Poll immediately
      pollActiveOrders();
      
      // Then poll every 30 seconds
      intervalRef.current = setInterval(pollActiveOrders, 30000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isTracking, deliveryPersonId, pollActiveOrders]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  const value = {
    isTracking,
    currentLocation,
    trackingOrders,
    deliveryPersonId,
    startTracking,
    stopTracking,
    addOrderToTracking,
    removeOrderFromTracking,
    pollActiveOrders
  };

  return (
    <LocationTrackingContext.Provider value={value}>
      {children}
    </LocationTrackingContext.Provider>
  );
}; 