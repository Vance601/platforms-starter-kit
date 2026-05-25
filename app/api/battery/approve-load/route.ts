import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Not signed in." },
        { status: 401 }
      );
    }
    const role = session.user.role;
    if (role !== "owner" && role !== "manager") {
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

    const approver = session.user.name || session.user.email || session.user.id;

    const { rows } = await sql`
      UPDATE battery_movements
      SET approval_status = 'approved',
          approved_at = now(),
          recorded_by_id = ${session.user.id},
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
