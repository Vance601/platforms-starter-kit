import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireOrg } from "@/lib/require-org";
import { ensureOrgSettingsTable, getOrgSettings, validateSettingsInput } from "@/lib/org-settings";

export const dynamic = "force-dynamic";

// Any signed-in staff user can read their org's settings.
export async function GET() {
  const g = await requireOrg();
  if (!g.ok) return g.response;
  const settings = await getOrgSettings(g.orgId);
  return NextResponse.json({ success: true, settings });
}

// Only the org owner can change them.
export async function PUT(req: Request) {
  const g = await requireOrg({ roles: ["owner"] });
  if (!g.ok) return g.response;
  const body = await req.json().catch(() => ({}));
  const v = validateSettingsInput(body);
  if (!v.ok) return NextResponse.json({ success: false, error: v.error }, { status: 400 });
  await ensureOrgSettingsTable();
  const s = v.value;
  await sql`
    INSERT INTO org_settings (org_id, barcode_prefix, timezone, core_charge, updated_at)
    VALUES (${String(g.orgId)}, ${s.barcodePrefix}, ${s.timezone}, ${s.coreCharge}, now())
    ON CONFLICT (org_id) DO UPDATE SET
      barcode_prefix = EXCLUDED.barcode_prefix,
      timezone = EXCLUDED.timezone,
      core_charge = EXCLUDED.core_charge,
      updated_at = now();
  `;
  return NextResponse.json({ success: true, settings: s });
}
