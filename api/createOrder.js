const { createClient } = require('@supabase/supabase-js');
const assignDeliveryBoyToOrder = require('./assignDeliveryBoy');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function createOrderAndAssign(req, res) {
  try {
    const orderData = req.body;
    // Insert the order (do NOT set delivery_person_id or assignment_status here)
    const { data: insertedOrders, error: insertError } = await supabase
      .from('orders')
      .insert([orderData])
      .select();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    const order = insertedOrders[0];
    // Assign delivery boy using your robust logic
    const assignedBoy = await assignDeliveryBoyToOrder(order, order.restaurant_id, []);
    // Fetch the updated order (with delivery_person_id, assignment_status, assignment_time)
    const { data: updatedOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order.id)
      .single();

    return res.status(200).json({
      order: updatedOrder,
      assignedBoy: assignedBoy || null
    });
  } catch (err) {
    console.error('Error in createOrderAndAssign:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = createOrderAndAssign; 