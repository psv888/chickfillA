const { createClient } = require('@supabase/supabase-js');
let fetch;
try {
  fetch = global.fetch || require('node-fetch');
} catch (e) {
  fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
}
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getLatLngFromZip(zipcode, country = 'India') {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&country=${country}&format=json&limit=1`;
  const res = await fetch(url);
  const text = await res.text();
  console.log('Geocode API response for zipcode', zipcode, ':', text);
  if (text.trim().startsWith('<')) {
    console.error('Geocode API returned HTML, likely rate-limited or error page.');
    return null;
  }
  try {
    const data = JSON.parse(text);
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch (e) {
    console.error('Failed to parse geocode response:', text);
    return null;
  }
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function assignDeliveryBoyToOrder(order, restaurantId, declinedIds = []) {
  try {
    console.log('Starting assignment for order:', order.id, 'restaurant:', restaurantId);
    // 1. Get restaurant zipcode
    const { data: restaurant, error: restError } = await supabase
      .from('admin_items')
      .select('zipcode')
      .eq('id', restaurantId)
      .single();
    if (restError) console.log('Restaurant fetch error:', restError);
    console.log('Restaurant data:', restaurant);
    if (!restaurant || !restaurant.zipcode) {
      console.log('No restaurant or zipcode found');
      return;
    }
    const restLatLng = await getLatLngFromZip(restaurant.zipcode);
    console.log('Restaurant lat/lng:', restLatLng);
    // 2. Get online delivery boys, excluding declined
    const { data: deliveryBoys, error: boysError } = await supabase
      .from('delivery_personnel')
      .select('id, full_name, zipcode')
      .eq('is_online', true);
    if (boysError) console.log('Delivery boys fetch error:', boysError);
    console.log('Online delivery boys:', deliveryBoys);
    const filteredBoys = deliveryBoys.filter(boy => !declinedIds.includes(boy.id));
    console.log('Filtered delivery boys (excluding declined):', filteredBoys);
    let assignedBoy = null;
    if (restLatLng) {
      // 3. Get lat/lng for each delivery boy and calculate distance
      const boysWithZip = filteredBoys.filter(boy => boy.zipcode);
      const boysWithDistance = [];
      for (const boy of boysWithZip) {
        const boyLatLng = await getLatLngFromZip(boy.zipcode);
        if (!boyLatLng) continue;
        const distance = getDistanceKm(restLatLng.lat, restLatLng.lon, boyLatLng.lat, boyLatLng.lon);
        boysWithDistance.push({ ...boy, distance });
      }
      console.log('Boys with distance:', boysWithDistance);
      // 4. Sort by distance and pick the closest
      boysWithDistance.sort((a, b) => a.distance - b.distance);
      assignedBoy = boysWithDistance[0];
      // 5. Fallback: If no one with zipcode, assign to any online person not in declined list (round robin)
      if (!assignedBoy) {
        const fallbackBoys = filteredBoys.filter(boy => !boy.zipcode);
        if (fallbackBoys.length > 0) {
          assignedBoy = fallbackBoys[0];
          console.log('Fallback: assigning to online delivery boy without zipcode:', assignedBoy);
        }
      }
    } else {
      // If restaurant geocoding fails, assign to any online delivery person not in declined list
      if (filteredBoys.length > 0) {
        assignedBoy = filteredBoys[0];
        console.log('Geocoding failed, fallback: assigning to any online delivery boy:', assignedBoy);
      }
    }
    // 6. Assign order with pending acceptance and update declined_delivery_person_ids
    if (assignedBoy) {
      console.log('Assigning order to delivery boy:', assignedBoy.id, typeof assignedBoy.id);
      const updateObj = {
        delivery_person_id: assignedBoy.id,
        assignment_status: 'pending_acceptance',
        declined_delivery_person_ids: JSON.stringify(declinedIds),
        assignment_time: new Date().toISOString()
      };
      console.log('Assigning with:', updateObj);
      const { data, error } = await supabase
        .from('orders')
        .update(updateObj)
        .eq('id', order.id)
        .select();
      console.log('Order assignment update result:', data, error);
      if (error) {
        console.error('Error assigning order:', error);
        return null;
      }
      console.log('Order assigned successfully');
      return assignedBoy;
    } else {
      console.log('No available delivery boy found');
      return null;
    }
  } catch (err) {
    console.error('assignDeliveryBoyToOrder error:', err);
    throw err;
  }
}

module.exports = assignDeliveryBoyToOrder; 