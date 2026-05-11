export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  category_id: string | null;
  source_url: string | null;
  created_at: string;
  categories?: Category;
  product_variants?: ProductVariant[];
  product_images?: ProductImage[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string | null;
  shade_name: string;
  color_hex: string | null;
  swatch_image_url: string | null;
  stock_qty: number;
  created_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  sort_order: number;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string | null;
  product_id: string | null;
  quantity: number;
  price: number;
  product_variants?: ProductVariant & { products?: Product };
  products?: Product;
}

export interface CartItem {
  key: string;            // unique line-item identifier: `${variant.id}::${shade_override ?? ""}`
  product: Product;
  variant: ProductVariant;
  quantity: number;
  shade_override?: string; // image-based shade label (e.g. "001", "Couleur 2")
}
