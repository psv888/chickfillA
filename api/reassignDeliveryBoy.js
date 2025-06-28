require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

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
  // 1. Fetch order
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order) return;

  let declinedIds = [];
  try {
    declinedIds = JSON.parse(order.declined_delivery_person_ids || '[]');
  } catch { declinedIds = []; }
  const restaurantId = order.restaurant_id;
  if (!restaurantId) return;

  // 2. Get restaurant zipcode
  const { data: restaurant } = await supabase.from('admin_items').select('zipcode').eq('id', restaurantId).single();
  if (!restaurant || !restaurant.zipcode) return;
  const restLatLng = await getLatLngFromZip(restaurant.zipcode);

  // 3. Get online delivery boys, excluding declined
  const { data: deliveryBoys } = await supabase
    .from('delivery_personnel')
    .select('id, full_name, zipcode')
    .eq('is_online', true);

  const filteredBoys = deliveryBoys.filter(boy => !declinedIds.includes(boy.id));
  const boysWithDistance = [];
  for (const boy of filteredBoys) {
    if (!boy.zipcode) continue;
    const boyLatLng = await getLatLngFromZip(boy.zipcode);
    if (!boyLatLng) continue;
    const distance = getDistanceKm(restLatLng.lat, restLatLng.lon, boyLatLng.lat, boyLatLng.lon);
    boysWithDistance.push({ ...boy, distance });
  }
  boysWithDistance.sort((a, b) => a.distance - b.distance);
  const assignedBoy = boysWithDistance[0];

  // 4. Assign order with pending acceptance and update declined_delivery_person_ids
  if (assignedBoy) {
    await supabase
      .from('orders')
      .update({
        delivery_person_id: assignedBoy.id,
        assignment_status: 'pending_acceptance',
        declined_delivery_person_ids: JSON.stringify(declinedIds)
      })
      .eq('id', orderId);
    return assignedBoy;
  } else {
    // No available delivery boy
    return null;
  }
}

module.exports = reassignDeliveryBoy; 