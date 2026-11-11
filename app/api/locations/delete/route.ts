import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";
import { countLocationRefs, reassignLocationRefs, refsTotal } from "@/lib/location-remove";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET  /api/locations/delete?id=   → usage counts + other locations in the company (for the picker)
// POST /api/locations/delete       → { id, reassignTo } reassign every reference, then delete
//                                     (or soft-deactivate if a leftover FK remains).
// Owner/manager only, org-scoped. Never touches another org's locations.

async function gate() {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, res: NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 }) };
  if (user.role !== "owner" && user.role !== "manager") {
    return { ok: false as const, res: NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 }) };
  }
  if (!user.orgId) {
    return { ok: false as const, res: NextResponse.json({ success: false, error: "No organization context." }, { status: 403 }) };
  }
  return { ok: true as const, user: { ...user, orgId: user.orgId } };
}

async function loadOwnedLocation(id: string, orgId: string) {
  const { rows } = await sql`
    SELECT l.id, l.name, l.slug, l.company_id, l.active, c.name AS company_name, c.org_id
    FROM locations l
    JOIN companies c ON c.id = l.company_id
    WHERE l.id = ${id} AND c.org_id = ${orgId}
    LIMIT 1;`;
  return rows[0] || null;
}

export async function GET(req: NextRequest) {
  const g = await gate();
  if (!g.ok) return g.res;
  const id = (req.nextUrl.searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ success: false, error: "Location id is required." }, { status: 400 });

  const loc = await loadOwnedLocation(id, g.user.orgId);
  if (!loc) return NextResponse.json({ success: false, error: "Location not found." }, { status: 404 });

  const refs = await countLocationRefs(id);
  const { rows: others } = await sql`
    SELECT l.id, l.name, l.slug, l.active, c.name AS company_name
    FROM locations l
    JOIN companies c ON c.id = l.company_id
    WHERE c.org_id = ${g.user.orgId}
      AND l.company_id = ${loc.company_id}
      AND l.id <> ${id}
      AND l.active = TRUE
    ORDER BY l.name;`;

  return NextResponse.json({
    success: true,
    location: { id: loc.id, name: loc.name, slug: loc.slug, companyName: loc.company_name, active: loc.active },
    refs,
    total: refsTotal(refs),
    otherLocations: others,
  });
}

export async function POST(req: NextRequest) {
  const g = await gate();
  if (!g.ok) return g.res;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "").trim();
  const reassignTo = String(body.reassignTo || "").trim();
  if (!id) return NextResponse.json({ success: false, error: "Location id is required." }, { status: 400 });

  const loc = await loadOwnedLocation(id, g.user.orgId);
  if (!loc) return NextResponse.json({ success: false, error: "Location not found." }, { status: 404 });

  const before = await countLocationRefs(id);
  const live = before.filter((r) => r.count > 0);

  if (live.length && !reassignTo) {
    return NextResponse.json(
      {
        success: false,
        error: "This location still has records. Choose a location to move them to before removing it.",
        refs: live,
        requireReassign: true,
      },
      { status: 400 },
    );
  }

  if (reassignTo) {
    if (reassignTo === id) {
      return NextResponse.json({ success: false, error: "Pick a different location to move records to." }, { status: 400 });
    }
    const dest = await loadOwnedLocation(reassignTo, g.user.orgId);
    if (!dest) return NextResponse.json({ success: false, error: "Destination location not found." }, { status: 404 });
    if (dest.company_id !== loc.company_id) {
      return NextResponse.json(
        { success: false, error: "Pick a location in the same company." },
        { status: 400 },
      );
    }
  }

  let moved: { table: string; column: string; count: number }[] = [];
  let mode: "deleted" | "deactivated" = "deleted";

  await sql.query("BEGIN");
  try {
    if (reassignTo) {
      moved = await reassignLocationRefs(id, reassignTo);
    }

    // Try a hard delete now that live FKs should be gone.
    try {
      const { rowCount } = await sql`
        DELETE FROM locations AS l
        USING companies AS c
        WHERE l.id = ${id}
          AND c.id = l.company_id
          AND c.org_id = ${g.user.orgId};`;
      if (!rowCount) throw new Error("Location not found during delete.");
      mode = "deleted";
    } catch (e) {
      // Leftover FK (an unlisted table) — hide it instead of failing the whole job.
      const { rows } = await sql`
        UPDATE locations AS l
        SET active = false
        FROM companies AS c
        WHERE l.id = ${id}
          AND c.id = l.company_id
          AND c.org_id = ${g.user.orgId}
        RETURNING l.id;`;
      if (!rows.length) throw e;
      mode = "deactivated";
    }

    await sql.query("COMMIT");
  } catch (err: unknown) {
    await sql.query("ROLLBACK").catch(() => {});
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }

  await logAudit({
    action: "location.remove",
    actorType: "user",
    actorId: g.user.userId,
    orgId: g.user.orgId,
    companyId: loc.company_id,
    entityType: "location",
    entityId: id,
    details: {
      name: loc.name,
      mode,
      reassignTo: reassignTo || null,
      before,
      moved,
    },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    id,
    name: loc.name,
    mode,
    reassignTo: reassignTo || null,
    moved,
    message:
      mode === "deleted"
        ? `${loc.name} was removed${reassignTo ? " and its records were moved" : ""}.`
        : `${loc.name} was hidden (historical records still referenced it)${reassignTo ? " after moving what we could" : ""}.`,
  });
}
