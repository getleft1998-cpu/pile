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
  addItem: (product: Product, variant: ProductVariant, shadeOverride?: string) => void;
  removeItem: (key: string) => void;
  updateQty: (key: string, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "flormar_cart";

function makeKey(variantId: string, shadeOverride?: string): string {
  return `${variantId}::${shadeOverride ?? ""}`;
}

function normalizeItem(item: Partial<CartItem> & { variant: ProductVariant }): CartItem {
  return {
    key: item.key ?? makeKey(item.variant.id, item.shade_override),
    product: item.product!,
    variant: item.variant,
    quantity: item.quantity ?? 1,
    shade_override: item.shade_override,
  };
}

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Array<
      Partial<CartItem> & { variant: ProductVariant }
    >;
    return raw.map(normalizeItem);
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

  const addItem = useCallback(
    (product: Product, variant: ProductVariant, shadeOverride?: string) => {
      const key = makeKey(variant.id, shadeOverride);
      setItems((prev) => {
        const existing = prev.find((i) => i.key === key);
        const next = existing
          ? prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i))
          : [
              ...prev,
              {
                key,
                product,
                variant,
                quantity: 1,
                shade_override: shadeOverride,
              },
            ];
        saveCart(next);
        return next;
      });
    },
    []
  );

  const removeItem = useCallback((key: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.key !== key);
      saveCart(next);
      return next;
    });
  }, []);

  const updateQty = useCallback((key: string, qty: number) => {
    if (qty < 1) return;
    setItems((prev) => {
      const next = prev.map((i) => (i.key === key ? { ...i, quantity: qty } : i));
      saveCart(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    saveCart([]);
  }, []);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce(
    (s, i) => s + (i.product.sale_price ?? i.product.price) * i.quantity,
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
