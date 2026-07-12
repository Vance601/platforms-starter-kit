// app/api/core-accountability/route.ts
// READ-ONLY. Driver attribution = battery_movements.driver_id (drivers table).
// Owner/manager only, scoped to the caller's organization.

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  if (user.role !== 'owner' && user.role !== 'manager') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (!user.orgId) {
    return NextResponse.json({
      outstanding: [],
      summary: { owed: 0, returned: 0, customer_kept: 0, other: 0, total: 0 },
    });
  }

  try {
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
      GROUP BY d.name, mdl.code
      ORDER BY cores_owed DESC, driver_name ASC;
    `;

    const { rows: summaryRows } = await sql`
      SELECT status, COUNT(*)::int AS n
      FROM core_returns
      WHERE company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
      GROUP BY status;
    `;

    const summary = {
      owed: 0,
      returned: 0,
      customer_kept: 0,
      other: 0,
      total: 0,
    };

    for (const row of summaryRows as { status: string; n: number }[]) {
      const n = Number(row.n) || 0;
      summary.total += n;
      if (row.status === 'owed') summary.owed = n;
      else if (row.status === 'returned') summary.returned = n;
      else if (row.status === 'customer_kept') summary.customer_kept = n;
      else summary.other += n;
    }

    return NextResponse.json({ outstanding, summary });
  } catch (err) {
    console.error('[core-accountability] GET failed:', err);
    return NextResponse.json(
      { error: 'Failed to load core accountability data.' },
      { status: 500 }
    );
  }
}
