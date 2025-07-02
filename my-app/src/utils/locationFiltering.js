import { supabase } from '../supabaseClient';

// Helper: Get lat/lng from zipcode using Nominatim
export async function getLatLngFromZip(zipcode, country = 'India') {
  try {
    // Try India first, fallback to US if not found
    let url = `https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&country=${country}&format=json&limit=1`;
    let res = await fetch(url);
    let data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    // Fallback to US if India fails
    if (country === 'India') {
      url = `https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&country=United States&format=json&limit=1`;
      res = await fetch(url);
      data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting lat/lng from zipcode:', error);
    return null;
  }
}

// Helper: Haversine distance in km
export function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Get user's current location from auth
export async function getUserLocation() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: userProfile } = await supabase
      .from('users')
      .select('zipcode')
      .eq('user_id', user.id)
      .single();

    return userProfile?.zipcode || null;
  } catch (error) {
    console.error('Error getting user location:', error);
    return null;
  }
}

// Filter restaurants by user location
export async function filterRestaurantsByLocation(restaurants, userZipcode, maxDistanceKm = 50) {
  if (!userZipcode) {
    console.log('No user zipcode available, showing all restaurants');
    return restaurants;
  }

  try {
    const userLatLng = await getLatLngFromZip(userZipcode);
    if (!userLatLng) {
      console.log('Could not get user location, showing all restaurants');
      return restaurants;
    }

    const filteredRestaurants = [];
    
    for (const restaurant of restaurants) {
      if (!restaurant.zipcode) {
        console.log(`Restaurant ${restaurant.name} has no zipcode, skipping`);
        continue;
      }

      const restaurantLatLng = await getLatLngFromZip(restaurant.zipcode);
      if (!restaurantLatLng) {
        console.log(`Could not get location for restaurant ${restaurant.name}, skipping`);
        continue;
      }

      const distance = getDistanceKm(
        userLatLng.lat, 
        userLatLng.lon, 
        restaurantLatLng.lat, 
        restaurantLatLng.lon
      );

      if (distance <= maxDistanceKm) {
        filteredRestaurants.push({
          ...restaurant,
          distance: distance
        });
      }
    }

    // Sort by distance
    filteredRestaurants.sort((a, b) => a.distance - b.distance);
    
    console.log(`Filtered ${restaurants.length} restaurants to ${filteredRestaurants.length} within ${maxDistanceKm}km`);
    return filteredRestaurants;
  } catch (error) {
    console.error('Error filtering restaurants by location:', error);
    return restaurants;
  }
}

// Filter menu items by user location
export async function filterMenuItemsByLocation(menuItems, userZipcode, maxDistanceKm = 50) {
  if (!userZipcode) {
    console.log('No user zipcode available, showing all menu items');
    return menuItems;
  }

  try {
    const userLatLng = await getLatLngFromZip(userZipcode);
    if (!userLatLng) {
      console.log('Could not get user location, showing all menu items');
      return menuItems;
    }

    // Get unique parent IDs from menu items
    const parentIds = [...new Set(menuItems.map(item => item.parent_id))];
    
    // Get parent locations
    const { data: parents } = await supabase
      .from('admin_items')
      .select('id, name, zipcode')
      .in('id', parentIds);

    if (!parents) {
      console.log('Could not get parent locations, showing all menu items');
      return menuItems;
    }

    const availableParentIds = new Set();
    
    for (const parent of parents) {
      if (!parent.zipcode) {
        console.log(`Parent ${parent.name} has no zipcode, skipping`);
        continue;
      }

      const parentLatLng = await getLatLngFromZip(parent.zipcode);
      if (!parentLatLng) {
        console.log(`Could not get location for parent ${parent.name}, skipping`);
        continue;
      }

      const distance = getDistanceKm(
        userLatLng.lat, 
        userLatLng.lon, 
        parentLatLng.lat, 
        parentLatLng.lon
      );

      if (distance <= maxDistanceKm) {
        availableParentIds.add(parent.id);
      }
    }

    const filteredMenuItems = menuItems.filter(item => availableParentIds.has(item.parent_id));
    
    console.log(`Filtered ${menuItems.length} menu items to ${filteredMenuItems.length} within ${maxDistanceKm}km`);
    return filteredMenuItems;
  } catch (error) {
    console.error('Error filtering menu items by location:', error);
    return menuItems;
  }
}

// Get restaurants with distance information
export async function getRestaurantsWithDistance(userZipcode, maxDistanceKm = 50) {
  try {
    const { data: restaurants, error } = await supabase
      .from('admin_items')
      .select('*')
      .eq('section', 'restaurants');

    if (error) {
      console.error('Error fetching restaurants:', error);
      return [];
    }

    return await filterRestaurantsByLocation(restaurants || [], userZipcode, maxDistanceKm);
  } catch (error) {
    console.error('Error getting restaurants with distance:', error);
    return [];
  }
}

// Get menu items with distance information
export async function getMenuItemsWithDistance(section, userZipcode, maxDistanceKm = 50) {
  try {
    const { data: menuItems, error } = await supabase
      .from('dishes')
      .select('*')
      .eq('section', section);

    if (error) {
      console.error('Error fetching menu items:', error);
      return [];
    }

    return await filterMenuItemsByLocation(menuItems || [], userZipcode, maxDistanceKm);
  } catch (error) {
    console.error('Error getting menu items with distance:', error);
    return [];
  }
}

// Format distance for display
export function formatDistance(distance) {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
}

// Check if location services are available
export function isLocationAvailable() {
  return 'geolocation' in navigator;
}

// Get user's current GPS location (if permission granted)
export function getCurrentGPSLocation() {
  return new Promise((resolve, reject) => {
    if (!isLocationAvailable()) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
} 