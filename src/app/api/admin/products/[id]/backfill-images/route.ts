import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { backfillProductImages } from "@/src/lib/image-backfill";

export const maxDuration = 60;

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const url = new URL(req.url);
  const overwrite = url.searchParams.get("overwrite") === "1";

  const result = await backfillProductImages(id, { overwrite });
  const status = result.status === "error" ? 500 : 200;
  return NextResponse.json(result, { status });
}
