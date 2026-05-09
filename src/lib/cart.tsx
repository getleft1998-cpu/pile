"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { CartItem, Product, ProductVariant } from "@/src/lib/types";

interface CartContextValue {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (product: Product, variant: ProductVariant) => void;
  removeItem: (variantId: string) => void;
  updateQty: (variantId: string, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "flormar_cart";

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(loadCart());
  }, []);

  const persist = (next: CartItem[]) => {
    setItems(next);
    saveCart(next);
  };

  const addItem = useCallback((product: Product, variant: ProductVariant) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variant.id === variant.id);
      const next = existing
        ? prev.map((i) =>
            i.variant.id === variant.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        : [...prev, { product, variant, quantity: 1 }];
      saveCart(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.variant.id !== variantId);
      saveCart(next);
      return next;
    });
  }, []);

  const updateQty = useCallback((variantId: string, qty: number) => {
    if (qty < 1) return;
    setItems((prev) => {
      const next = prev.map((i) =>
        i.variant.id === variantId ? { ...i, quantity: qty } : i
      );
      saveCart(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => persist([]), []);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce(
    (s, i) =>
      s +
      (i.product.sale_price ?? i.product.price) * i.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{ items, count, total, addItem, removeItem, updateQty, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
