console.log('server.js loaded and starting...');

const express = require('express');
const cors = require('cors');
const reassignDeliveryBoy = require('./api/reassignDeliveryBoy');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const createOrderAndAssign = require('./api/createOrder');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/reassign-delivery-boy', async (req, res) => {
  console.log('POST /api/reassign-delivery-boy called with body:', req.body);
  const { orderId } = req.body;
  if (!orderId) {
    console.error('Missing orderId in request body');
    return res.status(400).json({ error: 'Missing orderId' });
  }
  try {
    const result = await reassignDeliveryBoy(orderId);
    if (result) {
      res.json({ success: true, assignedBoy: result });
    } else {
      console.error('No available delivery boy found or assignment failed');
      res.status(404).json({ error: 'No available delivery boy found' });
    }
  } catch (e) {
    console.error('Error in /api/reassign-delivery-boy:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/create-order', createOrderAndAssign);

// Runs every 10 seconds
cron.schedule('*/10 * * * * *', async () => {
  console.log('Running auto-decline/reassign cron job...');
  const { data: pendingOrders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('assignment_status', 'pending_acceptance');

  if (error) {
    console.error('Error fetching pending orders:', error);
    return;
  }

  for (const order of pendingOrders) {
    console.log('CRON CHECK:', order.id, order.assignment_time, order.assignment_status, order.delivery_person_id, order.declined_delivery_person_ids);
    if (!order.assignment_time) continue;
    const assignedAt = new Date(order.assignment_time);
    const now = new Date();
    if ((now - assignedAt) > 29000) { // 29 seconds
      let declinedIds = [];
      try {
        declinedIds = JSON.parse(order.declined_delivery_person_ids || '[]');
      } catch { declinedIds = []; }
      if (order.delivery_person_id && !declinedIds.includes(order.delivery_person_id)) {
        declinedIds.push(order.delivery_person_id);
      }
      console.log('CRON: Auto-declining order', order.id, 'Declined IDs:', declinedIds);
      await supabase
        .from('orders')
        .update({
          assignment_status: 'declined',
          declined_delivery_person_ids: JSON.stringify(declinedIds)
        })
        .eq('id', order.id);

      await reassignDeliveryBoy(order.id);
      console.log(`Order #${order.id} auto-declined and reassigned by cron job.`);
    }
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API server running on port ${PORT}`)); 