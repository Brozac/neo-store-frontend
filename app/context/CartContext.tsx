'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Product = {
  id: number | string;
  name: string;
  price: number | string;
  description?: string;
  image_url?: string;
  image?: string;
  color?: string;
  size?: string;
  quantity?: number;
  vid?: string;
  [key: string]: any;
};

export type CartItem = Product & { quantity: number };

type CartContextType = {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: number | string, color?: string, size?: string) => void;
  updateQuantity: (productId: number | string, newQuantity: number, color?: string, size?: string) => void;
  clearCart: () => void;
  cartTotal: number;
  finalTotal: number; // ✨ الإجمالي بعد خصم العجلة
  wheelDiscount: number; // ✨ نسبة الخصم
  applyWheelDiscount: (percentage: number) => void; // ✨ دالة تفعيل الخصم
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [wheelDiscount, setWheelDiscount] = useState(0);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) setCart(JSON.parse(savedCart));
      
      const savedDiscount = localStorage.getItem('wheelDiscount');
      if (savedDiscount) setWheelDiscount(Number(savedDiscount));
    } catch (e) { console.error("Error reading cart", e); }
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
    }
  }, [cart, isMounted]);

  const parsePrice = (price: number | string): number => {
    if (typeof price === 'number') return price;
    const cleaned = String(price).replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const qty = Number(product.quantity) || 1;
      const existingItem = prevCart.find(
        (item) => item.id === product.id && item.color === product.color && item.size === product.size
      );
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id && item.color === product.color && item.size === product.size
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [...prevCart, { ...product, quantity: qty }];
    });
  };

  const removeFromCart = (productId: number | string, color?: string, size?: string) => {
    setCart((prevCart) => prevCart.filter(
      (item) => !(item.id === productId && item.color === color && item.size === size)
    ));
  };

  const updateQuantity = (productId: number | string, newQuantity: number, color?: string, size?: string) => {
    if (newQuantity < 1) {
      removeFromCart(productId, color, size);
      return;
    }
    setCart((prevCart) => prevCart.map((item) =>
      item.id === productId && item.color === color && item.size === size
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const clearCart = () => setCart([]);

  // ✨ دالة تطبيق خصم العجلة
  const applyWheelDiscount = (percentage: number) => {
    setWheelDiscount(percentage);
    localStorage.setItem('wheelDiscount', String(percentage));
  };

  const cartTotal = cart.reduce((total, item) => {
    return total + (parsePrice(item.price) * item.quantity);
  }, 0);

  // ✨ حساب الإجمالي النهائي بعد الخصم
  const discountAmount = (cartTotal * wheelDiscount) / 100;
  const finalTotal = cartTotal - discountAmount;

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, finalTotal, wheelDiscount, applyWheelDiscount }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};