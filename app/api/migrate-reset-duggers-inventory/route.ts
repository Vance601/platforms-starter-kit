import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { isPlatformOwner } from "@/lib/demo-leads";
import {
  backupDuggersInventory,
  buildResetPlan,
  deleteDuggersInventory,
  dumpsToFiles,
} from "@/lib/duggers-inventory-reset";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Duggers-only inventory reset.
 *
 * Auth: MIGRATE_SECRET (?secret=) OR platform-owner session.
 *
 * Modes:
 *   GET  ?dry_run=1              → counts only (no export body)
 *   GET  ?export=1               → full JSON backup + counts (no delete)
 *   POST ?confirm=RESET-DUGGERS-INVENTORY
 *        body/query export=1     → backup then delete in one transaction;
 *                                  response includes the backup + after counts
 *
 * Never prints the secret. Never touches users/drivers/companies/settings/
 * battery_types/battery_models/audit_log/demo_leads/other orgs.
 */
async function authorize(req: NextRequest): Promise<
  | { ok: true; userId: string | null }
  | { ok: false; res: NextResponse }
> {
  const secret = (req.nextUrl.searchParams.get("secret") || req.headers.get("x-migrate-secret") || "").trim();
  const migrate = (process.env.MIGRATE_SECRET || "").trim();
  const cron = (process.env.CRON_SECRET || "").trim();
  // Either server secret works; both live only in Vercel env / the box secrets dir.
  if (secret && ((migrate && secret === migrate) || (cron && secret === cron))) {
    return { ok: true, userId: null };
  }
  const user = await getCurrentUser();
  if (user && (await isPlatformOwner(user))) {
    return { ok: true, userId: user.userId };
  }
  return {
    ok: false,
    res: NextResponse.json(
      { error: "Unauthorized. Platform owner session or MIGRATE_SECRET required." },
      { status: 401 },
    ),
  };
}

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.res;

  const dry = req.nextUrl.searchParams.get("dry_run") === "1";
  const doExport = req.nextUrl.searchParams.get("export") === "1" || !dry;

  try {
    if (dry && !req.nextUrl.searchParams.get("export")) {
      const plan = await buildResetPlan();
      return NextResponse.json({ success: true, mode: "dry_run", plan });
    }

    const backup = await backupDuggersInventory();
    const files = dumpsToFiles(backup.dumps, backup.plan, backup.exportedAt);
    // Verify backup row counts match plan
    const mismatches = backup.dumps.filter((d) => d.count !== (backup.plan.before[d.table] ?? 0));
    return NextResponse.json({
      success: true,
      mode: "export",
      plan: backup.plan,
      exportedAt: backup.exportedAt,
      backupVerified: mismatches.length === 0,
      mismatches: mismatches.map((d) => ({
        table: d.table,
        dump: d.count,
        plan: backup.plan.before[d.table] ?? 0,
      })),
      files: {
        manifest: files.manifest,
        json: files.json,
        csv: files.csv,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.res;

  const confirm =
    req.nextUrl.searchParams.get("confirm") ||
    (await req.clone().json().catch(() => ({}))).confirm ||
    "";
  if (confirm !== "RESET-DUGGERS-INVENTORY") {
    return NextResponse.json(
      {
        error: "Refusing to delete. POST with confirm=RESET-DUGGERS-INVENTORY after saving an export.",
      },
      { status: 400 },
    );
  }

  try {
    // 1) Backup first
    const backup = await backupDuggersInventory();
    const files = dumpsToFiles(backup.dumps, backup.plan, backup.exportedAt);
    const mismatches = backup.dumps.filter((d) => d.count !== (backup.plan.before[d.table] ?? 0));
    if (mismatches.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Backup count mismatch — delete aborted.",
          mismatches,
        },
        { status: 500 },
      );
    }

    // 2) Delete in one transaction
    const result = await deleteDuggersInventory(backup.plan);

    // Re-stamp audit with actor if we have one (delete already wrote system entry)
    if (auth.userId) {
      await logAudit({
        action: "inventory.reset",
        actorType: "user",
        actorId: auth.userId,
        orgId: backup.plan.orgId,
        entityType: "organization",
        entityId: backup.plan.orgId,
        details: { deleted: result.deleted, after: result.after, via: "platform-owner" },
      }).catch(() => {});
    }

    const zeros = Object.entries(result.after).filter(([, n]) => n !== 0);
    const otherChanged = Object.keys(backup.plan.otherOrgsBefore).filter(
      (k) => (backup.plan.otherOrgsBefore[k] ?? 0) !== (result.otherOrgsAfter[k] ?? 0),
    );

    return NextResponse.json({
      success: zeros.length === 0 && otherChanged.length === 0,
      mode: "reset",
      plan: backup.plan,
      deleted: result.deleted,
      after: result.after,
      otherOrgsAfter: result.otherOrgsAfter,
      duggersCleared: zeros.length === 0,
      otherOrgsUnchanged: otherChanged.length === 0,
      otherOrgsChanged: otherChanged,
      exportedAt: backup.exportedAt,
      backupVerified: true,
      files: {
        manifest: files.manifest,
        json: files.json,
        csv: files.csv,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
