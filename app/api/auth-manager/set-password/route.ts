// Retired: shared-secret password setter (also promoted roles).
// Use POST /api/admin/users with a real owner/manager session instead.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { success: false, error: "Retired. Reset passwords at /admin/users while signed in." },
    { status: 410 }
  );
}
