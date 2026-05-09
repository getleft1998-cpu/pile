import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/src/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await createAdminClient()
    .from("products")
    .insert(body)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
