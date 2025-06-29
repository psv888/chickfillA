const assignDeliveryBoyToOrder = require('./assignDeliveryBoy');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getLatLngFromZip(zipcode, country = 'India') {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&country=${country}&format=json&limit=1`;
  const res = await fetch(url);
  const data = await res.json();
  if (data && data.length > 0) {
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  }
  return null;
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

async function reassignDeliveryBoy(orderId) {
  try {
    console.log('reassignDeliveryBoy called with orderId:', orderId);
    // 1. Fetch order
    const { data: order, error: orderError } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (orderError) console.log('Order fetch error:', orderError);
    if (!order) { console.log('No order found for id', orderId); return; }

    let declinedIds = [];
    try {
      declinedIds = JSON.parse(order.declined_delivery_person_ids || '[]');
    } catch (e) { 
      console.log('Error parsing declined_delivery_person_ids:', e);
      declinedIds = []; 
    }
    const restaurantId = order.restaurant_id;
    if (!restaurantId) { console.log('No restaurant_id in order'); return; }

    // Use the shared assignment logic
    return await assignDeliveryBoyToOrder(order, restaurantId, declinedIds);
  } catch (err) {
    console.error('reassignDeliveryBoy error:', err);
    throw err;
  }
}

module.exports = reassignDeliveryBoy; 