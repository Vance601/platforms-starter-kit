import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Owner gate: ?pw= must match MIGRATE_SECRET (same pattern as the read route).
function ownerOk(req: NextRequest): boolean {
  const pw = req.nextUrl.searchParams.get("pw") || "";
  const secret = process.env.MIGRATE_SECRET || "";
  return secret.length > 0 && pw === secret;
}

export async function POST(req: NextRequest) {
  try {
    if (!ownerOk(req)) {
      return NextResponse.json(
        { success: false, error: "Not authorized." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const movementId: string | undefined = body?.movementId;
    const approvedByRaw: string | undefined = body?.approvedBy;

    if (!movementId) {
      return NextResponse.json(
        { success: false, error: "No movement selected." },
        { status: 400 }
      );
    }

    const approvedBy = (approvedByRaw || "").trim();
    if (!approvedBy) {
      return NextResponse.json(
        { success: false, error: "Please enter your name to approve." },
        { status: 400 }
      );
    }

    // Approve ONLY if it is still a pending load. The WHERE guard makes this
    // idempotent and safe: an already-approved or non-load row updates 0 rows.
    //   approval_status -> 'approved'
    //   approved_at     -> now()
    //   recorded_by_id  -> the typed approver name (column is free text, unconstrained)
    const { rows } = await sql`
      UPDATE battery_movements
      SET approval_status = 'approved',
          approved_at = now(),
          recorded_by_id = ${approvedBy}
      WHERE id = ${movementId}
        AND approval_status = 'pending'
        AND to_status = 'on_truck'
      RETURNING id, approved_at;
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "That load was not approved — it may have already been approved or is no longer pending.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Load approved by ${approvedBy}.`,
      movementId: rows[0].id,
      approvedAt: rows[0].approved_at,
      approvedBy,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
