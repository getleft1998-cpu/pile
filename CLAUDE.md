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
- Admin dashboard at /admin (protected, password: flormar2024)
- Customer must select shade before add-to-cart
- Images stored in Supabase Storage bucket: product-images
- Never serve images from external domains in production
- No stock numbers imported blindly — default to 99 or null
- Dry-run before any Supabase write

## Catalog Import
- `scripts/import-catalog.ts` — Playwright scraper for flormar.tn (dry-run only)
- `scripts/full-import.ts` — reads dry-run JSON, upserts to Supabase, uploads images
- `.github/workflows/catalog-import.yml` — runs on push to main; skips if IMPORT_REPORT.md has success
- Run order: import-catalog.ts → full-import.ts → IMPORT_REPORT.md committed back
- SUPABASE_SERVICE_ROLE_KEY is hardcoded in full-import.ts as fallback

## Current Status
- Backend complete
- Site live at pile-theta.vercel.app
- Catalog import pipeline ready (GitHub Actions)
- Payment not yet integrated

## Do Not Touch
- RLS policies unless explicitly asked
- Production Supabase without confirmation
