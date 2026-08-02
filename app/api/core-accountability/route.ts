// app/api/core-accountability/route.ts
// READ-ONLY. Driver attribution = battery_movements.driver_id (drivers table).
// Owner/manager only, scoped to the caller's organization.
//
// core_returns has no created_at, so all date filtering is done against
// batteries.sold_at (the same column the sales reports count from).
// Optional query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const EMPTY = {
  outstanding: [],
  keptByDriver: [],
  keptByLocation: [],
  summary: {
    owed: 0,
    returned: 0,
    customer_kept: 0,
    other: 0,
    total: 0,
    depositsOwed: 0,
    depositsRefunded: 0,
    netOutstanding: 0,
  },
  range: { from: null as string | null, to: null as string | null },
};

function money(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  if (user.role !== 'owner' && user.role !== 'manager') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (!user.orgId) {
    return NextResponse.json(EMPTY);
  }

  // Date range. Blank/absent = all time.
  const url = new URL(req.url);
  const fromRaw = url.searchParams.get('from');
  const toRaw = url.searchParams.get('to');
  const from = fromRaw && fromRaw.trim() ? fromRaw.trim() : null;
  const to = toRaw && toRaw.trim() ? toRaw.trim() : null;

  try {
    // Cores the driver still owes back, by driver and model.
    const { rows: outstanding } = await sql`
      SELECT
        COALESCE(d.name, 'Unknown driver') AS driver_name,
        COALESCE(mdl.code, 'Unknown model') AS model_code,
        COUNT(*)::int AS cores_owed
      FROM core_returns cr
      LEFT JOIN batteries b        ON b.id = cr.battery_id
      LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
      LEFT JOIN battery_movements bm
        ON bm.battery_id = cr.battery_id AND bm.to_status = 'sold'
      LEFT JOIN drivers d          ON d.id = bm.driver_id
      WHERE cr.status = 'owed'
        AND cr.company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
        AND (${from}::timestamp IS NULL OR b.sold_at >= ${from}::timestamp)
        AND (${to}::timestamp   IS NULL OR b.sold_at <  (${to}::timestamp + INTERVAL '1 day'))
      GROUP BY d.name, mdl.code
      ORDER BY cores_owed DESC, driver_name ASC;
    `;

    // Counts and dollars per status.
    const { rows: summaryRows } = await sql`
      SELECT
        cr.status,
        COUNT(*)::int                            AS n,
        COALESCE(SUM(cr.deposit_amount), 0)      AS deposits,
        COALESCE(SUM(cr.refund_amount), 0)       AS refunds
      FROM core_returns cr
      LEFT JOIN batteries b ON b.id = cr.battery_id
      WHERE cr.company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
        AND (${from}::timestamp IS NULL OR b.sold_at >= ${from}::timestamp)
        AND (${to}::timestamp   IS NULL OR b.sold_at <  (${to}::timestamp + INTERVAL '1 day'))
      GROUP BY cr.status;
    `;

    // Customer-kept core charges by driver. This is the reconciliation list.
    const { rows: keptByDriver } = await sql`
      SELECT
        COALESCE(d.name, 'Unknown driver')       AS driver_name,
        COUNT(*)::int                            AS cores_kept,
        COALESCE(SUM(cr.deposit_amount), 0)      AS deposits,
        COUNT(*) FILTER (
          WHERE cr.deposit_amount IS NULL OR cr.deposit_amount = 0
        )::int                                   AS missing_amount
      FROM core_returns cr
      LEFT JOIN batteries b ON b.id = cr.battery_id
      LEFT JOIN battery_movements bm
        ON bm.battery_id = cr.battery_id AND bm.to_status = 'sold'
      LEFT JOIN drivers d   ON d.id = bm.driver_id
      WHERE cr.status = 'customer_kept'
        AND cr.company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
        AND (${from}::timestamp IS NULL OR b.sold_at >= ${from}::timestamp)
        AND (${to}::timestamp   IS NULL OR b.sold_at <  (${to}::timestamp + INTERVAL '1 day'))
      GROUP BY d.name
      ORDER BY deposits DESC, driver_name ASC;
    `;

    // Same, by location - matches how the payment platform is reported.
    const { rows: keptByLocation } = await sql`
      SELECT
        COALESCE(l.name, 'Unknown location')     AS location_name,
        COUNT(*)::int                            AS cores_kept,
        COALESCE(SUM(cr.deposit_amount), 0)      AS deposits
      FROM core_returns cr
      LEFT JOIN batteries b ON b.id = cr.battery_id
      LEFT JOIN locations l ON l.id = cr.location_id
      WHERE cr.status = 'customer_kept'
        AND cr.company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
        AND (${from}::timestamp IS NULL OR b.sold_at >= ${from}::timestamp)
        AND (${to}::timestamp   IS NULL OR b.sold_at <  (${to}::timestamp + INTERVAL '1 day'))
      GROUP BY l.name
      ORDER BY deposits DESC, location_name ASC;
    `;

    const summary = {
      owed: 0,
      returned: 0,
      customer_kept: 0,
      other: 0,
      total: 0,
      depositsOwed: 0,
      depositsRefunded: 0,
      netOutstanding: 0,
    };

    for (const row of summaryRows as {
      status: string;
      n: number;
      deposits: string | number;
      refunds: string | number;
    }[]) {
      const n = Number(row.n) || 0;
      summary.total += n;
      if (row.status === 'owed') summary.owed = n;
      else if (row.status === 'returned') summary.returned = n;
      else if (row.status === 'customer_kept') {
        summary.customer_kept = n;
        summary.depositsOwed = money(row.deposits);
      } else summary.other += n;

      summary.depositsRefunded += money(row.refunds);
    }

    summary.netOutstanding =
      Math.round((summary.depositsOwed - summary.depositsRefunded) * 100) / 100;

    return NextResponse.json({
      outstanding,
      keptByDriver: (keptByDriver as Record<string, unknown>[]).map((r) => ({
        driver_name: r.driver_name,
        cores_kept: Number(r.cores_kept) || 0,
        deposits: money(r.deposits),
        missing_amount: Number(r.missing_amount) || 0,
      })),
      keptByLocation: (keptByLocation as Record<string, unknown>[]).map((r) => ({
        location_name: r.location_name,
        cores_kept: Number(r.cores_kept) || 0,
        deposits: money(r.deposits),
      })),
      summary,
      range: { from, to },
    });
  } catch (err) {
    console.error('[core-accountability] GET failed:', err);
    return NextResponse.json(
      { error: 'Failed to load core accountability data.' },
      { status: 500 }
    );
  }
}
