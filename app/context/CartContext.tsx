// context/CartContext.tsx - Type-Safe Cart Engine
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export type Product = {
  id: number | string;
  name: string; // ✨ جعلها string إجبارية لتتوافق 100% مع صفحات السلة والـ Build
  title?: string;
  price: number | string;
  original_price?: number | string;
  description?: string;
  image_url?: string;
  image?: string;
  color?: string;
  size?: string;
  quantity?: number;
  vid?: string;
  [key: string]: any;
};

export type CartItem = Product & { 
  quantity: number;
  displayTitle: string;
  displayImage: string;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (itemKey: any) => void;
  updateQuantity: (itemKey: any, newQuantity: number, color?: string, size?: string) => void;
  clearCart: () => void;
  cartTotal: number;
  finalTotal: number;
  totalItemsCount: number;
  wheelDiscount: number;
  applyWheelDiscount: (percentage: number) => void;
  isMounted: boolean;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const MAX_ITEM_QUANTITY = 50;

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

  // 1. استعادة السلة من localStorage
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
      console.error("CartContext: Error restoring cart", e);
    } finally {
      setIsMounted(true);
    }
  }, []);

  // 2. حفظ السلة في localStorage
  useEffect(() => {
    if (isMounted) {
      try {
        localStorage.setItem('cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cartUpdated'));
      } catch (e) {
        console.error("CartContext: Error saving cart", e);
      }
    }
  }, [cart, isMounted]);

  // 3. مزامنة عبر النوافذ والتبويبات
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

  // ✨ إضافة منتج للسلة وضمان أن name و title نصوص حقيقية دائماً
  const addToCart = useCallback((product: any, incomingQuantity?: number) => {
    setCart((prevCart) => {
      const targetKey = getCartItemKey(product);
      const addQty = Math.min(
        MAX_ITEM_QUANTITY, 
        Math.max(1, incomingQuantity !== undefined ? incomingQuantity : (Number(product.quantity) || 1))
      );

      const resolvedTitle = (product.title || product.name || 'Product').trim();
      const displayImage = product.image_url || product.image || '/placeholder.jpg';

      const existingIndex = prevCart.findIndex((item) => getCartItemKey(item) === targetKey);

      if (existingIndex > -1) {
        const updated = [...prevCart];
        const currentQty = updated[existingIndex].quantity;
        const newQty = Math.min(MAX_ITEM_QUANTITY, currentQty + addQty);
        
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...product,
          name: resolvedTitle, // ✨ مضمون كنص دائماً
          title: resolvedTitle,
          displayTitle: resolvedTitle,
          displayImage,
          quantity: newQty,
        };
        return updated;
      }

      return [
        ...prevCart, 
        { 
          ...product, 
          name: resolvedTitle, // ✨ مضمون كنص دائماً
          title: resolvedTitle,
          displayTitle: resolvedTitle, 
          displayImage,
          quantity: addQty, 
        }
      ];
    });
  }, []);

  // ✨ تدعم حذف المنتجات سواء بالمفتاح الموحد أو بالطريقة القديمة (productId, color, size)
  const removeFromCart = useCallback((itemKeyOrId: any, color?: string, size?: string) => {
    setCart((prevCart) => prevCart.filter((item) => {
      if (color !== undefined || size !== undefined) {
        return !(item.id === itemKeyOrId && item.color === color && item.size === size);
      }
      return getCartItemKey(item) !== String(itemKeyOrId) && item.id !== itemKeyOrId;
    }));
  }, []);

  // ✨ تدعم تعديل الكمية بالطريقتين
  const updateQuantity = useCallback((itemKeyOrId: any, newQuantity: number, color?: string, size?: string) => {
    if (newQuantity < 1) {
      removeFromCart(itemKeyOrId, color, size);
      return;
    }

    const safeQty = Math.min(MAX_ITEM_QUANTITY, newQuantity);

    setCart((prevCart) =>
      prevCart.map((item) => {
        const isMatch = (color !== undefined || size !== undefined)
          ? (item.id === itemKeyOrId && item.color === color && item.size === size)
          : (getCartItemKey(item) === String(itemKeyOrId) || item.id === itemKeyOrId);

        return isMatch ? { ...item, quantity: safeQty } : item;
      })
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

  const totalItemsCount = cart.reduce((count, item) => count + item.quantity, 0);

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