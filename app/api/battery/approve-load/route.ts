import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not signed in." },
        { status: 401 }
      );
    }
    if (user.role !== "owner" && user.role !== "manager") {
      return NextResponse.json(
        { success: false, error: "You don't have permission to approve loads." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const movementId: string | undefined = body?.movementId;
    if (!movementId) {
      return NextResponse.json(
        { success: false, error: "No movement selected." },
        { status: 400 }
      );
    }

    // Resolve a human-readable approver label for the audit note.
    // getCurrentUser() returns role/ids but not name/email, so look them up.
    let approver = user.userId;
    try {
      const { rows: who } = await sql`
        SELECT name, email FROM users WHERE id = ${user.userId} LIMIT 1;
      `;
      if (who.length > 0) {
        approver = (who[0].name as string) || (who[0].email as string) || user.userId;
      }
    } catch {
      // fall back to userId if the lookup fails
    }

    const { rows } = await sql`
      UPDATE battery_movements
      SET approval_status = 'approved',
          approved_at = now(),
          recorded_by_id = ${user.userId},
          notes = COALESCE(notes, '') || ${` | Approved by ${approver}`}
      WHERE id = ${movementId}
        AND approval_status = 'pending'
        AND to_status = 'on_truck'
      RETURNING id, approved_at;
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "That load was not approved — it may have already been approved or is no longer pending." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Load approved by ${approver}.`,
      movementId: rows[0].id,
      approvedAt: rows[0].approved_at,
      approvedBy: approver,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
