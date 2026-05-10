import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";
import { ensureBucketPublic } from "@/src/lib/image-backfill";

// Temporary diagnostic + repair endpoint. Remove after troubleshooting.
// GET   = sample URLs + reachability probe
// POST  = mark the product-images bucket public
export async function GET() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("product_images")
    .select("id, product_id, url, sort_order")
    .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const checks = await Promise.all(
    (data ?? []).map(async (row) => {
      try {
        const res = await fetch(row.url, { method: "HEAD" });
        return {
          url: row.url,
          fetch_status: res.status,
          content_type: res.headers.get("content-type"),
          content_length: res.headers.get("content-length"),
        };
      } catch (e) {
        return {
          url: row.url,
          fetch_status: "fetch_error",
          error: String(e),
        };
      }
    })
  );

  return NextResponse.json({
    total_in_db: data?.length ?? 0,
    samples: checks,
  });
}

export async function POST() {
  await ensureBucketPublic();
  return NextResponse.json({ ok: true, action: "bucket marked public" });
}
