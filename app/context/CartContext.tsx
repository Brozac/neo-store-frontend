'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export type Product = {
  id: number | string;
  title?: string;
  name?: string; // دعم الاسمين title و name لتفادي أي خطأ
  price: number | string;
  original_price?: number | string;
  description?: string;
  image_url?: string;
  image?: string;
  color?: string;
  size?: string;
  quantity?: number;
  vid?: string; // معرف المتغير الأساسي في CJ
  [key: string]: any;
};

export type CartItem = Product & { 
  quantity: number;
  displayTitle: string;
  displayImage: string;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (itemKey: string) => void;
  updateQuantity: (itemKey: string, newQuantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  finalTotal: number;
  totalItemsCount: number;
  wheelDiscount: number;
  applyWheelDiscount: (percentage: number) => void;
  isMounted: boolean;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const MAX_ITEM_QUANTITY = 50; // مطابق للحد الأقصى في السيرفر utils/secureCheckout.js

// ✨ دالة لتوليد مفتاح فريد ومطلق لكل عنصر في السلة
export const getCartItemKey = (item: { id: number | string; vid?: string; color?: string; size?: string }): string => {
  if (item.vid) {
    return `${item.id}_VID_${item.vid}`;
  }
  return `${item.id}_${item.color || 'NOCOLOR'}_${item.size || 'NOSIZE'}`;
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [wheelDiscount, setWheelDiscount] = useState(0);

  // 1. قراءة السلة والخصم عند أول تشغيل
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
      
      const savedDiscount = localStorage.getItem('wheelDiscount');
      if (savedDiscount) {
        setWheelDiscount(Math.min(100, Math.max(0, Number(savedDiscount) || 0)));
      }
    } catch (e) {
      console.error("CartContext: Error restoring cart from localStorage", e);
    } finally {
      setIsMounted(true);
    }
  }, []);

  // 2. مزامنة السلة مع LocalStorage وإطلاق الحدث المحلي
  useEffect(() => {
    if (isMounted) {
      try {
        localStorage.setItem('cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cartUpdated'));
      } catch (e) {
        console.error("CartContext: Error saving cart to localStorage", e);
      }
    }
  }, [cart, isMounted]);

  // 3. ✨ مزامنة السلة عبر التبويبات المتعددة (Cross-Tab Sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cart' && e.newValue) {
        try {
          setCart(JSON.parse(e.newValue));
        } catch (err) {}
      }
      if (e.key === 'wheelDiscount' && e.newValue) {
        setWheelDiscount(Number(e.newValue) || 0);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const parsePrice = (price: number | string): number => {
    if (typeof price === 'number') return isNaN(price) ? 0 : price;
    const cleaned = String(price).replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // ✨ إضافة منتج للسلة بمطابقة فريدة بواسطة vid
  const addToCart = useCallback((product: Product, incomingQuantity?: number) => {
    setCart((prevCart) => {
      const targetKey = getCartItemKey(product);
      const addQty = Math.min(
        MAX_ITEM_QUANTITY, 
        Math.max(1, incomingQuantity !== undefined ? incomingQuantity : (Number(product.quantity) || 1))
      );

      const existingIndex = prevCart.findIndex((item) => getCartItemKey(item) === targetKey);

      const displayTitle = (product.title || product.name || 'Product').trim();
      const displayImage = product.image_url || product.image || '/placeholder.jpg';

      if (existingIndex > -1) {
        const updated = [...prevCart];
        const currentQty = updated[existingIndex].quantity;
        const newQty = Math.min(MAX_ITEM_QUANTITY, currentQty + addQty);
        
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...product,
          quantity: newQty,
          displayTitle,
          displayImage
        };
        return updated;
      }

      return [
        ...prevCart, 
        { 
          ...product, 
          quantity: addQty, 
          displayTitle, 
          displayImage 
        }
      ];
    });
  }, []);

  // ✨ حذف منتج بواسطة المفتاح الفريد المطلق
  const removeFromCart = useCallback((itemKey: string) => {
    setCart((prevCart) => prevCart.filter((item) => getCartItemKey(item) !== itemKey));
  }, []);

  // ✨ تحديث الكمية بأمان
  const updateQuantity = useCallback((itemKey: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(itemKey);
      return;
    }

    const safeQty = Math.min(MAX_ITEM_QUANTITY, newQuantity);

    setCart((prevCart) =>
      prevCart.map((item) =>
        getCartItemKey(item) === itemKey ? { ...item, quantity: safeQty } : item
      )
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCart([]);
    try {
      localStorage.removeItem('cart');
    } catch (e) {}
  }, []);

  const applyWheelDiscount = useCallback((percentage: number) => {
    const safePercent = Math.min(100, Math.max(0, percentage));
    setWheelDiscount(safePercent);
    try {
      localStorage.setItem('wheelDiscount', String(safePercent));
    } catch (e) {}
  }, []);

  // حساب عدد القطع الإجمالي
  const totalItemsCount = cart.reduce((count, item) => count + item.quantity, 0);

  // حساب إجمالي السلة بدقة عالية ومنع مشاكل الفاصلة العائمة
  const rawCartTotal = cart.reduce((total, item) => {
    const unitPrice = parsePrice(item.price);
    return total + (unitPrice * item.quantity);
  }, 0);

  const cartTotal = parseFloat(rawCartTotal.toFixed(2));
  const discountMultiplier = Math.max(0, (100 - wheelDiscount) / 100);
  const finalTotal = parseFloat((cartTotal * discountMultiplier).toFixed(2));

  return (
    <CartContext.Provider 
      value={{ 
        cart, 
        addToCart, 
        removeFromCart, 
        updateQuantity, 
        clearCart, 
        cartTotal, 
        finalTotal, 
        totalItemsCount,
        wheelDiscount, 
        applyWheelDiscount,
        isMounted
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};