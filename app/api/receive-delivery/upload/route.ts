import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Uploads a delivery-receipt file to Vercel Blob and returns its public URL.
// No database writes — the page saves the URL via createDeliveryReceipt.
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file || typeof file !== "object" || file.size === 0) {
      return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
    }

    const safeName = file.name || `delivery-${Date.now()}`;
    const blob = await put(
      `receive/delivery/${Date.now()}-${safeName}`,
      file,
      { access: "public", addRandomSuffix: true }
    );

    return NextResponse.json({
      success: true,
      url: blob.url,
      fileName: safeName,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
