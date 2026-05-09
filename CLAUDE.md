# Flormar Ecommerce — Project Context

## Stack
Next.js, React, Tailwind, Supabase, Vercel

## Supabase Tables
- categories (id, name, slug)
- products (id, name, slug, description, price, sale_price, category_id, source_url)
- product_variants (id, product_id, sku, shade_name, color_hex, swatch_image_url, stock_qty)
- orders (id, user_id, status, total)
- order_items (id, order_id, variant_id, quantity, price)

## Key Rules
- Admin dashboard at /admin (protected)
- Customer must select shade before add-to-cart
- Images stored in Supabase Storage bucket: product-images
- Never serve images from external domains in production
- No stock numbers imported blindly — default to 99 or null
- Dry-run before any Supabase write

## Current Status
- Backend complete
- Catalog import in progress (dry-run phase)
- Payment not yet integrated

## Do Not Touch
- RLS policies unless explicitly asked
- Production Supabase without confirmation
