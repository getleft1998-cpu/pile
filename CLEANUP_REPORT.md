# Flormar Tunisia — DB Cleanup Report

Generated: 2026-05-11T11:13:00Z  
Status: **success**

## What Was Cleaned

French/Arabic categories (leftover from the original Converty API seed) and all
products, variants, and images linked exclusively to them were deleted.

## Dry-Run Summary (before deletion)

| Category | Slug | Products |
|----------|------|--------:|
| Lèvres | levres | 5 |
| Yeux | yeux | 7 |
| Teint | teint | 8 |
| Sourcils | sourcils | 3 |
| Ongles | ongles | 4 |
| Soins | soins | 5 |
| **Total** | | **32** |

## Deletion Results

| Metric | Count |
|--------|------:|
| Order items deleted | 5 |
| Product images deleted | 58 |
| Product variants deleted | 87 |
| Products deleted | 32 |
| Categories deleted | 6 |
| Errors | 0 |

## English Categories Kept

| Name | Old Slug | New Slug |
|------|----------|----------|
| Face | category-1 | face |
| Eyes | category-2 | eyes |
| Lips | category-3 | lips |
| Accessories | ksswrt | accessories |
| Skincare | laany-blbshr | skincare |

Slugs were updated to canonical English values as part of the cleanup.

## Post-Cleanup State

- **Categories**: 5 (Face, Eyes, Lips, Accessories, Skincare)
- **Products**: 82 (all English, under English categories)
- **French/Arabic categories**: 0
