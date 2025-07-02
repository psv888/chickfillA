const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testAssignment() {
  console.log('Testing delivery assignment...');
  
  // 1. Check if there are any online delivery personnel
  const { data: deliveryBoys, error: boysError } = await supabase
    .from('delivery_personnel')
    .select('id, full_name, zipcode, is_online')
    .eq('is_online', true);
  
  if (boysError) {
    console.error('Error fetching delivery boys:', boysError);
    return;
  }
  
  console.log('Online delivery boys:', deliveryBoys);
  
  if (!deliveryBoys || deliveryBoys.length === 0) {
    console.log('❌ No online delivery personnel found!');
    console.log('Please ensure at least one delivery person is online.');
    return;
  }
  
  // 2. Check if there are any restaurants with zipcodes
  const { data: restaurants, error: restError } = await supabase
    .from('admin_items')
    .select('id, name, zipcode')
    .eq('section', 'restaurants');
  
  if (restError) {
    console.error('Error fetching restaurants:', restError);
    return;
  }
  
  console.log('Restaurants:', restaurants);
  
  if (!restaurants || restaurants.length === 0) {
    console.log('❌ No restaurants found!');
    return;
  }
  
  // 3. Check for restaurants with zipcodes
  const restaurantsWithZip = restaurants.filter(r => r.zipcode);
  console.log('Restaurants with zipcodes:', restaurantsWithZip);
  
  if (restaurantsWithZip.length === 0) {
    console.log('❌ No restaurants have zipcodes!');
    console.log('Please add zipcodes to restaurants for distance-based assignment.');
    return;
  }
  
  // 4. Check for delivery personnel with zipcodes
  const deliveryBoysWithZip = deliveryBoys.filter(b => b.zipcode);
  console.log('Delivery boys with zipcodes:', deliveryBoysWithZip);
  
  if (deliveryBoysWithZip.length === 0) {
    console.log('⚠️ No delivery personnel have zipcodes!');
    console.log('Assignment will use fallback method.');
  }

  // 5. Insert a real test order into the database
  const testOrderData = {
    user_id: deliveryBoys[0].id, // Use a delivery boy's id as user_id for test (or replace with a real user id)
    name: 'Test Customer',
    phone: '1234567890',
    address: 'Test Address',
    items: [{ item_id: 1, qty: 2 }],
    total_amount: 100,
    restaurant_id: restaurantsWithZip[0].id,
    status: 'pending',
  };

  const { data: insertedOrders, error: insertError } = await supabase
    .from('orders')
    .insert([testOrderData])
    .select();

  if (insertError) {
    console.error('❌ Error inserting test order:', insertError);
    return;
  }

  const testOrder = insertedOrders[0];
  console.log('Inserted test order:', testOrder);

  // 6. Test the assignment function
  const assignDeliveryBoyToOrder = require('./api/assignDeliveryBoy');

  try {
    const assignedBoy = await assignDeliveryBoyToOrder(testOrder, testOrder.restaurant_id, []);
    if (assignedBoy) {
      console.log('✅ Assignment successful!');
      console.log('Assigned to:', assignedBoy.full_name, '(ID:', assignedBoy.id, ')');
    } else {
      console.log('❌ Assignment failed - no delivery boy available');
    }
  } catch (error) {
    console.error('❌ Assignment error:', error);
  }

  // 7. Try to track the order using the RPC function
  try {
    const { data: trackedOrder, error: trackError } = await supabase
      .rpc('get_order_with_geojson_location', { order_id_param: testOrder.id })
      .single();
    if (trackError || !trackedOrder) {
      console.log('❌ Order not found for tracking!');
    } else {
      console.log('✅ Order found for tracking:', trackedOrder);
    }
  } catch (error) {
    console.error('❌ Tracking error:', error);
  }
}

testAssignment().catch(console.error); 