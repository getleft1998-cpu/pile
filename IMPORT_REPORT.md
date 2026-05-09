# Flormar Tunisia — Catalog Import Report

Generated: 2026-05-09T12:10:00Z  
Status: **pending**  
Reason: GitHub Actions workflow has not committed a result after multiple triggers  

---

## What Is Working

| Task | Status |
|------|--------|
| Site live at pile-theta.vercel.app | ✅ |
| All pages return 200 | ✅ |
| Admin login (`flormar2024`) | ✅ |
| `npm run build` passes (14 routes) | ✅ |
| Supabase connection | ✅ |
| Catalog import pipeline (code) | ✅ |
| Catalog data in Supabase | ⏳ Pending |

## Why the Import Hasn't Run

The GitHub Actions workflow has been triggered 8+ times since 04:14 UTC
but has never committed a result back to `main`. Possible causes:

1. **Actions disabled for this repo** — Go to `Settings → Actions → General`
   and ensure "Allow all actions" is selected.

2. **Branch protection blocking bot push** — Go to `Settings → Branches`
   and check if `main` requires PRs. If so, add `github-actions[bot]` as
   a bypass actor, or disable "Require a pull request before merging".

3. **Check workflow run logs** — Go to:
   https://github.com/getleft1998-cpu/pile/actions
   and open any recent "Catalog Import" run to see which step failed.

## How to Trigger a Fresh Run

Once you've confirmed Actions is enabled, either:
- Push any commit to `main`, or
- Go to https://github.com/getleft1998-cpu/pile/actions/workflows/catalog-import.yml
  and click **Run workflow**

The workflow will:
1. Fetch product catalog from flormar.tn (plain HTTP, ~3 min)
2. Upsert categories/products/variants into Supabase (~1 min)
3. Store image source URLs (no upload for speed)
4. Overwrite this file with real import totals

## Supabase Project

- URL: https://yqgtjgvqeogsykkpgxiy.supabase.co
- Tables: `categories`, `products`, `product_variants`, `product_images`
- Storage bucket: `product-images`

## Site

- Production: https://pile-theta.vercel.app
- Admin: https://pile-theta.vercel.app/admin (password: `flormar2024`)
