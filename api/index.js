require('dotenv').config();
const express = require('express');
const reassignDeliveryBoy = require('./reassignDeliveryBoy');
const app = express();
app.use(express.json());

app.post('/api/reassign-delivery-boy', async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
  const result = await reassignDeliveryBoy(orderId);
  if (result) {
    res.json({ success: true, assignedBoy: result });
  } else {
    res.json({ success: false, message: 'No available delivery boy' });
  }
});

app.listen(3001, () => console.log('API running on port 3001')); 