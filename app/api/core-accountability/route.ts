// app/api/core-accountability/route.ts
// READ-ONLY. No writes. Returns:
//   - outstanding: owed cores grouped by driver + model
//   - summary: counts per status (owed / returned / customer_kept)
//
// Driver attribution = battery_movements.driver_id WHERE to_status='sold'
//   (NOT batteries.current_driver_id — that is nulled on sale).
// core_returns has NO created_at; owed rows have null returned_at.

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    // Outstanding (not turned in) by driver + model.
    const outstanding = await sql`
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
      GROUP BY d.name, mdl.code
      ORDER BY cores_owed DESC, driver_name ASC;
    `;

    // Summary counts per status.
    const summaryRows = await sql`
      SELECT status, COUNT(*)::int AS n
      FROM core_returns
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
