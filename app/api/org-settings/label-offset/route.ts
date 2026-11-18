import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireOrg } from "@/lib/require-org";
import {
  DEFAULT_ORG_SETTINGS,
  ensureOrgSettingsTable,
  getOrgSettings,
  validateLabelOffsetInput,
} from "@/lib/org-settings";

export const dynamic = "force-dynamic";

// Owner or manager can set the org-wide label print offset so every device
// in the org uses the same compensation for this printer.
export async function PUT(req: Request) {
  const g = await requireOrg({ roles: ["owner", "manager"] });
  if (!g.ok) return g.response;
  const body = await req.json().catch(() => ({}));
  const v = validateLabelOffsetInput(body);
  if (!v.ok) return NextResponse.json({ success: false, error: v.error }, { status: 400 });
  await ensureOrgSettingsTable();
  const current = await getOrgSettings(g.orgId);
  await sql`
    INSERT INTO org_settings (
      org_id, barcode_prefix, timezone, core_charge,
      label_offset_x_in, label_offset_y_in, updated_at
    )
    VALUES (
      ${String(g.orgId)},
      ${current.barcodePrefix || DEFAULT_ORG_SETTINGS.barcodePrefix},
      ${current.timezone || DEFAULT_ORG_SETTINGS.timezone},
      ${current.coreCharge ?? DEFAULT_ORG_SETTINGS.coreCharge},
      ${v.xIn}, ${v.yIn}, now()
    )
    ON CONFLICT (org_id) DO UPDATE SET
      label_offset_x_in = EXCLUDED.label_offset_x_in,
      label_offset_y_in = EXCLUDED.label_offset_y_in,
      updated_at = now();
  `;
  const settings = await getOrgSettings(g.orgId);
  return NextResponse.json({ success: true, settings });
}
