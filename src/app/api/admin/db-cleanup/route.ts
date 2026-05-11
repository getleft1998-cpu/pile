import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";

export const maxDuration = 120;

// Match by lowercased name so garbled API slugs (category-1, ksswrt, etc.) don't cause false positives
const ENGLISH_CATEGORY_NAMES = new Set([
  "face", "lips", "eyes", "nails", "skincare", "accessories", "eyebrows",
]);

// Canonical slug for each English name
const ENGLISH_SLUG: Record<string, string> = {
  face: "face", lips: "lips", eyes: "eyes", nails: "nails",
  skincare: "skincare", accessories: "accessories", eyebrows: "eyebrows",
};

export async function GET(req: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD ?? "flormar2024";
  const token =
    req.cookies.get("admin_token")?.value ??
    req.headers.get("x-admin-token") ??
    new URL(req.url).searchParams.get("token");
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const dryRun = params.get("dry") === "1";
  const confirm = params.get("confirm") === "1";

  if (!dryRun && !confirm) {
    return NextResponse.json(
      { error: "Pass ?dry=1 to preview or ?confirm=1 to execute cleanup." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Fetch all categories
  const { data: allCats, error: catsErr } = await supabase
    .from("categories")
    .select("id, name, slug");
  if (catsErr) return NextResponse.json({ error: catsErr.message }, { status: 500 });

  const isEnglish = (c: { name: unknown }) =>
    ENGLISH_CATEGORY_NAMES.has((c.name as string ?? "").toLowerCase());

  const englishCats = (allCats ?? []).filter(isEnglish);
  const frenchCats = (allCats ?? []).filter((c) => !isEnglish(c));
  const frenchCatIds = frenchCats.map((c) => c.id as string);

  // Count products per French category
  const catReports: Array<{ id: string; name: string; slug: string; productCount: number }> = [];
  for (const cat of frenchCats) {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", cat.id);
    catReports.push({ id: cat.id as string, name: cat.name as string, slug: cat.slug as string, productCount: count ?? 0 });
  }

  // Products that belong ONLY to French categories (not also English ones)
  const { data: frenchProducts } = frenchCatIds.length
    ? await supabase.from("products").select("id, name, slug").in("category_id", frenchCatIds)
    : { data: [] };

  const frenchProductIds = (frenchProducts ?? []).map((p) => p.id as string);

  if (dryRun) {
    return NextResponse.json({
      mode: "dry-run",
      englishCategoriesKept: englishCats.map((c) => ({
        name: c.name, currentSlug: c.slug,
        willBeUpdatedToSlug: ENGLISH_SLUG[(c.name as string ?? "").toLowerCase()] ?? c.slug,
      })),
      frenchCategoriesToDelete: catReports,
      totalProductsToDelete: frenchProductIds.length,
      productSample: (frenchProducts ?? []).slice(0, 10).map((p) => ({ name: p.name, slug: p.slug })),
    });
  }

  // confirm=1 — delete in FK-safe order
  if (!frenchProductIds.length && !frenchCatIds.length) {
    return NextResponse.json({ ok: true, message: "Nothing to clean up.", deletedProducts: 0, deletedCategories: 0 });
  }

  const errors: string[] = [];
  let deletedOrderItems = 0;
  let deletedImages = 0;
  let deletedVariants = 0;
  let deletedProducts = 0;
  let deletedCategories = 0;

  if (frenchProductIds.length) {
    // Get variant IDs to delete order_items referencing them
    const { data: variantRows } = await supabase
      .from("product_variants")
      .select("id")
      .in("product_id", frenchProductIds);
    const variantIds = (variantRows ?? []).map((v) => v.id as string);

    // Delete order_items referencing these products or variants
    if (variantIds.length) {
      const { error: oiErr, count: oiCount } = await supabase
        .from("order_items")
        .delete({ count: "exact" })
        .in("variant_id", variantIds);
      if (oiErr) errors.push(`order_items(variant): ${oiErr.message}`);
      else deletedOrderItems += oiCount ?? 0;
    }

    const { error: oiErr2, count: oiCount2 } = await supabase
      .from("order_items")
      .delete({ count: "exact" })
      .in("product_id", frenchProductIds);
    if (oiErr2) errors.push(`order_items(product): ${oiErr2.message}`);
    else deletedOrderItems += oiCount2 ?? 0;

    // Delete product_images
    const { error: imgErr, count: imgCount } = await supabase
      .from("product_images")
      .delete({ count: "exact" })
      .in("product_id", frenchProductIds);
    if (imgErr) errors.push(`product_images: ${imgErr.message}`);
    else deletedImages = imgCount ?? 0;

    // Delete product_variants
    const { error: varErr, count: varCount } = await supabase
      .from("product_variants")
      .delete({ count: "exact" })
      .in("product_id", frenchProductIds);
    if (varErr) errors.push(`product_variants: ${varErr.message}`);
    else deletedVariants = varCount ?? 0;

    // Delete products
    const { error: prodErr, count: prodCount } = await supabase
      .from("products")
      .delete({ count: "exact" })
      .in("id", frenchProductIds);
    if (prodErr) errors.push(`products: ${prodErr.message}`);
    else deletedProducts = prodCount ?? 0;
  }

  // Fix slugs of kept English categories to canonical English slugs
  for (const cat of englishCats) {
    const canonicalSlug = ENGLISH_SLUG[(cat.name as string ?? "").toLowerCase()];
    if (canonicalSlug && cat.slug !== canonicalSlug) {
      await supabase.from("categories").update({ slug: canonicalSlug }).eq("id", cat.id);
    }
  }

  // Delete French categories
  if (frenchCatIds.length) {
    const { error: catErr, count: catCount } = await supabase
      .from("categories")
      .delete({ count: "exact" })
      .in("id", frenchCatIds);
    if (catErr) errors.push(`categories: ${catErr.message}`);
    else deletedCategories = catCount ?? 0;
  }

  const summary = {
    ok: errors.length === 0,
    mode: "confirm",
    deletedOrderItems,
    deletedImages,
    deletedVariants,
    deletedProducts,
    deletedCategories,
    deletedCategoryNames: catReports.map((c) => c.name),
    errors,
  };

  return NextResponse.json(summary);
}
