// Shared battery_models catalog (global reference data, not per-org).
// Alpha / Bravo / AGM / … are battery_types (classifications / lines).
// Group sizes like 78, 94R, SX48 are battery_models.code under one type.
import { sql } from "@vercel/postgres";
import { logAudit } from "@/lib/audit";

export type CatalogResult = {
  added: string[];
  moved: string[];
  deactivated: string[];
  skipped: string[];
  notes: string[];
  counts: Record<string, number>;
};

async function typeId(code: string): Promise<string | null> {
  const { rows } = await sql`SELECT id FROM battery_types WHERE code = ${code} LIMIT 1;`;
  return (rows[0]?.id as string) || null;
}

async function ensureDescriptionColumn() {
  await sql`ALTER TABLE battery_models ADD COLUMN IF NOT EXISTS description TEXT;`;
}

async function ensureModel(opts: {
  code: string;
  typeCode: string;
  displayName?: string;
  description?: string | null;
  result: CatalogResult;
}) {
  const { code, typeCode, displayName, description, result } = opts;
  const tid = await typeId(typeCode);
  if (!tid) {
    result.skipped.push(`${code} (missing type ${typeCode})`);
    return;
  }
  const { rows: existing } = await sql`
    SELECT id, battery_type_id, active, description FROM battery_models WHERE code = ${code} LIMIT 1;`;
  if (existing.length === 0) {
    await sql`
      INSERT INTO battery_models (code, display_name, battery_type_id, description, active)
      VALUES (${code}, ${displayName || code}, ${tid}, ${description ?? null}, TRUE);`;
    result.added.push(`${typeCode}/${code}`);
    return;
  }
  const row = existing[0];
  // Already present: keep type if it matches; refresh description/active.
  const { rows: curType } = await sql`SELECT code FROM battery_types WHERE id = ${row.battery_type_id} LIMIT 1;`;
  const cur = String(curType[0]?.code || "");
  if (cur && cur !== typeCode) {
    result.skipped.push(`${code} already under ${cur} (wanted ${typeCode})`);
  }
  if (description && row.description !== description) {
    await sql`UPDATE battery_models SET description = ${description} WHERE id = ${row.id};`;
  }
  if (row.active === false) {
    await sql`UPDATE battery_models SET active = TRUE WHERE id = ${row.id};`;
    result.notes.push(`Reactivated ${code}`);
  }
}

/** Move a model to another classification (codes are globally unique). */
async function moveModel(code: string, toType: string, result: CatalogResult) {
  const tid = await typeId(toType);
  if (!tid) {
    result.skipped.push(`move ${code}: missing type ${toType}`);
    return;
  }
  const { rows } = await sql`
    SELECT bm.id, bm.active, bt.code AS type_code
    FROM battery_models bm
    JOIN battery_types bt ON bt.id = bm.battery_type_id
    WHERE bm.code = ${code} LIMIT 1;`;
  if (rows.length === 0) {
    // Nothing to move — insert under the target type instead.
    await ensureModel({ code, typeCode: toType, result });
    return;
  }
  const row = rows[0];
  if (row.type_code === toType) {
    if (row.active === false) {
      await sql`UPDATE battery_models SET active = TRUE WHERE id = ${row.id};`;
      result.notes.push(`Reactivated ${code} under ${toType}`);
    } else {
      result.skipped.push(`${code} already under ${toType}`);
    }
    return;
  }

  const { rows: batt } = await sql`
    SELECT COUNT(*)::int AS n FROM batteries WHERE battery_model_id = ${row.id};`;
  let salesCount = 0;
  try {
    const { rows: sales } = await sql`
      SELECT COUNT(*)::int AS n
      FROM sale_records sr
      JOIN batteries b ON b.id = sr.battery_id
      WHERE b.battery_model_id = ${row.id};`;
    salesCount = Number(sales[0]?.n || 0);
  } catch {
    salesCount = 0;
  }
  const batteryCount = Number(batt[0]?.n || 0);
  result.counts[`${code}.batteries`] = batteryCount;
  result.counts[`${code}.sales`] = salesCount;

  // Codes are unique, so "remove from Alpha + add to Bravo" is a reclassify.
  await sql`UPDATE battery_models SET battery_type_id = ${tid}, active = TRUE WHERE id = ${row.id};`;
  // Keep unit rows consistent with the model's new classification.
  if (batteryCount > 0) {
    await sql`UPDATE batteries SET battery_type_id = ${tid} WHERE battery_model_id = ${row.id};`;
  }
  result.moved.push(`${code}: ${row.type_code} → ${toType} (${batteryCount} batteries, ${salesCount} sales)`);
}

/**
 * Idempotent catalog updates requested 2026-11-05:
 * - Alpha 94R add; Alpha 78 → Bravo 78 (unique code = move)
 * - City of Phoenix: Alpha SX48/SX86, Bravo SX94R/SX65, AGM 31xxD/31xxE
 */
export async function applyBatteryCatalogUpdates(actor?: {
  userId?: string | null;
  orgId?: string | null;
}): Promise<CatalogResult> {
  const result: CatalogResult = { added: [], moved: [], deactivated: [], skipped: [], notes: [], counts: {} };
  await ensureDescriptionColumn();

  // 1+3: Alpha 94R; move 78 Alpha → Bravo (cannot have two rows with code 78)
  await ensureModel({ code: "94R", typeCode: "Alpha", displayName: "94R", result });
  await moveModel("78", "Bravo", result);

  // 4: City of Phoenix set
  const phx = "City of Phoenix";
  await ensureModel({ code: "SX48", typeCode: "Alpha", displayName: "SX48", description: phx, result });
  await ensureModel({ code: "SX86", typeCode: "Alpha", displayName: "SX86", description: phx, result });
  await ensureModel({ code: "SX94R", typeCode: "Bravo", displayName: "SX94R", description: phx, result });
  await ensureModel({ code: "SX65", typeCode: "Bravo", displayName: "SX65", description: phx, result });
  // Kept literal "31xxD" / "31xxE" as written — meaning of "xx" is unclear (likely a family placeholder).
  await ensureModel({
    code: "31xxD",
    typeCode: "AGM",
    displayName: "31xxD",
    description: `${phx} (literal code as provided; confirm if a specific group size was intended)`,
    result,
  });
  await ensureModel({
    code: "31xxE",
    typeCode: "AGM",
    displayName: "31xxE",
    description: `${phx} (literal code as provided; confirm if a specific group size was intended)`,
    result,
  });

  result.notes.push(
    "Alpha/Bravo/AGM are battery_types (lines). Model codes are globally unique, so Alpha 78 → Bravo 78 is a reclassify, not two rows.",
  );

  await logAudit({
    action: "battery_catalog.update",
    actorType: actor?.userId ? "user" : "system",
    actorId: actor?.userId || "battery-catalog",
    orgId: actor?.orgId || null,
    entityType: "battery_models",
    details: {
      added: result.added,
      moved: result.moved,
      deactivated: result.deactivated,
      skipped: result.skipped,
      counts: result.counts,
    },
  }).catch(() => {});

  return result;
}

/** Model codes that UI fallbacks should know about (active catalog extras). */
export const EXTRA_MODEL_CODES = ["94R", "SX48", "SX86", "SX94R", "SX65", "31xxD", "31xxE"] as const;
