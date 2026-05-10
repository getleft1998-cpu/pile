# Flormar Ecommerce — Claude Reference

## Stack
Next.js 15 (App Router), React, Tailwind CSS, Supabase (Postgres + Storage), Vercel

## Live Site
- URL: pile-theta.vercel.app
- Admin: /admin/login — password: `flormar2024`

## Supabase
- Project URL: https://yqgtjgvqeogsykkpgxiy.supabase.co
- Anon key hardcoded in `src/lib/supabase.ts` (fallback, works without env vars)
- Service role key hardcoded in `src/lib/supabase.ts` and `scripts/full-import.ts` as fallback

### Tables (full schema)
```
categories      (id, name, slug, image_url, created_at)
products        (id, name, slug, description, price, sale_price, category_id→categories, source_url, created_at)
product_variants(id, product_id→products, sku, shade_name, color_hex, swatch_image_url, stock_qty, created_at)
orders          (id, customer_name, customer_phone, customer_address, customer_city, status, total, created_at)
order_items     (id, order_id→orders, variant_id→product_variants, product_id→products, quantity, price)
```

### Supabase Client Rules — CRITICAL
- **Never** use `getSupabase()` (anon key) for admin data — RLS blocks joins like `order_items → product_variants → products`
- **Always** use `createAdminClient()` in API routes (`/api/admin/*`) for any admin reads/writes
- `getSupabase()` is fine for public storefront data (products, categories, variants)
- Admin pages are client components → they must call `/api/admin/*` endpoints, not Supabase directly

## Key File Locations
```
src/app/admin/           — admin dashboard pages (client components)
src/app/api/admin/       — admin API routes (use createAdminClient)
src/app/api/orders/      — public order creation endpoint
src/lib/supabase.ts      — Supabase client factory
src/lib/types.ts         — shared TypeScript interfaces
src/middleware.ts        — auth guard for /admin/* routes
scripts/                 — catalog import scripts (excluded from tsconfig)
```

## Admin Auth
- Middleware at `src/middleware.ts` checks cookie `admin_session`
- Login POST to `/api/admin/auth` — middleware MUST skip this path
- Password hardcoded fallback: `flormar2024` (also set via `ADMIN_PASSWORD` env var)
- **Exempt paths in middleware**: `/admin/login` and `/api/admin/auth`

## Deployment Pipeline
- **GitHub App → Vercel** (automatic on every push to `main`) — this is what deploys the site
- `deploy.yml` GitHub Actions workflow also exists but is secondary; the GitHub App is faster
- To deploy: push to `main` branch (via `git push` or `mcp__github__push_files`)
- If `git push` fails with 403, use `mcp__github__push_files` tool instead
- Vercel project ID: `prj_cG2RSusP9gA7KHXgSE7E0aWzogAc` / team: `team_kAEHWEKTqPvlEN7ZzklwIEOr`
- Check deployment: `mcp__6157145a...__list_deployments` or `get_deployment`

## TypeScript / Build
- `tsconfig.json` excludes `scripts/**` — do not remove this, scripts have intentional TS errors
- Build uses Turbopack; Node 22 required (Supabase JS needs native WebSocket)
- `deploy.log` is tracked by git (`-f` flag needed since it's in `.gitignore`)

## Catalog Import
- `scripts/import-catalog.ts` — Playwright scraper for flormar.tn (dry-run only)
- `scripts/full-import.ts` — reads dry-run JSON, upserts to Supabase, uploads images
- Run order: import-catalog.ts → full-import.ts → IMPORT_REPORT.md committed back
- Images stored in Supabase Storage bucket: `product-images`

## Business Rules
- Customer must select a shade (variant) before add-to-cart
- Never serve images from external domains in production
- Stock defaults to 99 or null — never blindly import
- Payment: cash on delivery only, not yet integrated

## Testing After Every Deploy — REQUIRED
After every push to main, always verify the deployment worked:
1. Wait for `list_deployments` to show a new READY deployment for the commit
2. Fetch `https://pile-theta.vercel.app/` via `web_fetch_vercel_url` → must return 200
3. Fetch `https://pile-theta.vercel.app/api/admin/orders` → must return 401 (not 500)
   - 401 = endpoint exists and middleware is working correctly
   - 500 = server error (check build logs with `get_deployment_build_logs`)
4. Report the test results to the user before saying the fix is done

## Do Not Touch
- RLS policies unless explicitly asked
- Production Supabase data without confirmation
- `scripts/` TypeScript errors (they are known, excluded from build)
