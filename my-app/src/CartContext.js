import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState({}); // { [dishId]: { dish, quantity } }

  // Load cart from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('cart');
    if (stored) setCart(JSON.parse(stored));
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (dish) => {
    setCart(prev => ({
      ...prev,
      [dish.id]: {
        dish,
        quantity: (prev[dish.id]?.quantity || 0) + 1
      }
    }));
  };

  const removeFromCart = (dish) => {
    setCart(prev => {
      if (!prev[dish.id]) return prev;
      const newQty = prev[dish.id].quantity - 1;
      if (newQty <= 0) {
        const { [dish.id]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [dish.id]: {
          ...prev[dish.id],
          quantity: newQty
        }
      };
    });
  };

  const clearCart = () => setCart({});

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
} 