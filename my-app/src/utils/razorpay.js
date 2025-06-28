// Razorpay utility functions
let razorpayLoaded = false;

export const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      razorpayLoaded = true;
      resolve();
      return;
    }

    if (razorpayLoaded) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      razorpayLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Razorpay script'));
    };
    document.body.appendChild(script);
  });
};

export const getRazorpayKey = () => {
  const key = process.env.REACT_APP_RAZORPAY_KEY || 'rzp_test_oSMBArOJQPFRu9';
  console.log('Razorpay Key:', key); // Debug log
  return key;
};

export const createRazorpayOrder = (options) => {
  if (!window.Razorpay) {
    throw new Error('Razorpay is not loaded');
  }

  const defaultOptions = {
    key: getRazorpayKey(),
    currency: 'INR',
    name: 'Chicken App',
    description: 'Order Payment',
    theme: {
      color: '#ff4d5a'
    },
    modal: {
      ondismiss: function() {
        console.log('Payment modal closed');
      }
    }
  };

  const finalOptions = { ...defaultOptions, ...options };
  return new window.Razorpay(finalOptions);
}; 