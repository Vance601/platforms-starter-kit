import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET: data needed to drive the "Mark cores returned" form (this org only).
//   - locations: distinct company_id / location_id pairs that have owed cores
//   - owedByModel: per location+model, how many cores are currently owed
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }
  if (!user.orgId) {
    return NextResponse.json({ success: true, locations: [], owedByModel: [] });
  }

  try {
    const { rows: owedByModel } = await sql`
      SELECT
        cr.company_id,
        cr.location_id,
        COALESCE(mdl.code, 'Unknown') AS model_code,
        COUNT(*)::int AS owed
      FROM core_returns cr
      LEFT JOIN batteries b        ON b.id = cr.battery_id
      LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
      WHERE cr.status = 'owed'
        AND cr.company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
      GROUP BY cr.company_id, cr.location_id, mdl.code
      ORDER BY cr.company_id, cr.location_id, model_code;
    `;

    // Distinct locations that currently have owed cores.
    const locationsMap = new Map<string, { company_id: string; location_id: string }>();
    for (const r of owedByModel as { company_id: string; location_id: string }[]) {
      const key = `${r.company_id}::${r.location_id}`;
      if (!locationsMap.has(key)) {
        locationsMap.set(key, { company_id: r.company_id, location_id: r.location_id });
      }
    }

    return NextResponse.json({
      success: true,
      locations: Array.from(locationsMap.values()),
      owedByModel,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST: clear owed cores against an MBS invoice (or a manual entry). This org only.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }
  if (!user.orgId) {
    return NextResponse.json({ success: false, error: "No organization context." }, { status: 403 });
  }

  let body: {
    companyId?: string;
    locationId?: string;
    lines?: { modelCode?: string; qty?: number | string }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { companyId, locationId } = body;
  if (!companyId || !locationId) {
    return NextResponse.json(
      { success: false, error: "companyId and locationId are required." },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json(
      { success: false, error: "At least one line (modelCode + qty) is required." },
      { status: 400 }
    );
  }

  // Tenant guard: the target company must belong to the caller's org.
  const { rows: companyCheck } = await sql`
    SELECT id FROM companies
    WHERE id = ${companyId} AND org_id = ${user.orgId}
    LIMIT 1;
  `;
  if (companyCheck.length === 0) {
    return NextResponse.json({ success: false, error: "Company not found." }, { status: 404 });
  }

  // Normalize + validate lines.
  const lines: { modelCode: string; qty: number }[] = [];
  for (const l of body.lines) {
    const modelCode = (l.modelCode || "").toString().trim();
    const qty = typeof l.qty === "string" ? parseInt(l.qty, 10) : Number(l.qty);
    if (!modelCode) {
      return NextResponse.json(
        { success: false, error: "Each line needs a model code." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json(
        { success: false, error: `Quantity for model ${modelCode} must be a positive number.` },
        { status: 400 }
      );
    }
    lines.push({ modelCode, qty });
  }

  try {
    const results: {
      modelCode: string;
      requested: number;
      cleared: number;
      shortfall: number;
    }[] = [];

    for (const line of lines) {
      // Flip the oldest N owed cores of this model at this location, but only
      // within a company that belongs to the caller's org (defense in depth).
      const { rows } = await sql`
        UPDATE core_returns
        SET status = 'returned', returned_at = now()
        WHERE id IN (
          SELECT cr.id
          FROM core_returns cr
          LEFT JOIN batteries b         ON b.id = cr.battery_id
          LEFT JOIN battery_models mdl  ON mdl.id = b.battery_model_id
          LEFT JOIN battery_movements bm
            ON bm.battery_id = cr.battery_id AND bm.to_status = 'sold'
          WHERE cr.status = 'owed'
            AND cr.company_id = ${companyId}
            AND cr.location_id = ${locationId}
            AND cr.company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
            AND mdl.code = ${line.modelCode}
          ORDER BY bm.occurred_at ASC NULLS LAST
          LIMIT ${line.qty}
        )
        RETURNING id;
      `;

      const cleared = rows.length;
      results.push({
        modelCode: line.modelCode,
        requested: line.qty,
        cleared,
        shortfall: Math.max(0, line.qty - cleared),
      });
    }

    const totalCleared = results.reduce((s, r) => s + r.cleared, 0);
    const warnings = results
      .filter((r) => r.shortfall > 0)
      .map(
        (r) =>
          `Model ${r.modelCode}: invoice listed ${r.requested}, but only ${r.cleared} were owed (${r.shortfall} unaccounted).`
      );

    return NextResponse.json({
      success: true,
      totalCleared,
      results,
      warnings,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
