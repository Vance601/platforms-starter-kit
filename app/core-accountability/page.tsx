// app/core-accountability/page.tsx
// READ-ONLY report. Two sections:
//   1. Outstanding by driver  — who has not turned in their cores
//   2. Summary                — totals by status
// customer_kept is shown for transparency but is NOT "missing".

'use client';

import { useEffect, useState } from 'react';

type OutstandingRow = {
  driver_name: string;
  model_code: string;
  cores_owed: number;
};

type Summary = {
  owed: number;
  returned: number;
  customer_kept: number;
  other: number;
  total: number;
};

type ApiResponse = {
  outstanding: OutstandingRow[];
  summary: Summary;
  error?: string;
};

export default function CoreAccountabilityPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/core-accountability', {
          cache: 'no-store',
        });
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        if (!res.ok || json.error) {
          setError(json.error || 'Failed to load data.');
        } else {
          setData(json);
        }
      } catch {
        if (!cancelled) setError('Network error loading data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Core Accountability</h1>
      <p className="mt-1 text-sm text-gray-500">
        Read-only. Every sale owes a core back to the warehouse. Returned cores
        are cleared; customer-kept cores are not counted as missing.
      </p>

      {loading && (
        <p className="mt-8 text-sm text-gray-500">Loading…</p>
      )}

      {error && (
        <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && !loading && !error && (
        <>
          {/* Summary */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">Summary</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard
                label="Owed"
                value={data.summary.owed}
                accent="text-red-600"
                hint="Not turned in"
              />
              <SummaryCard
                label="Returned"
                value={data.summary.returned}
                accent="text-green-600"
                hint="Sent to MBS"
              />
              <SummaryCard
                label="Customer kept"
                value={data.summary.customer_kept}
                accent="text-gray-600"
                hint="No core exists"
              />
              <SummaryCard
                label="Total"
                value={data.summary.total}
                accent="text-gray-900"
                hint="All records"
              />
            </div>
          </section>

          {/* Outstanding by driver */}
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-gray-900">
              Outstanding by Driver
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Cores owed to the warehouse, grouped by driver and battery model.
            </p>

            {data.outstanding.length === 0 ? (
              <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                No outstanding cores. Everyone is squared up.
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-2 font-medium">Driver</th>
                      <th className="px-4 py-2 font-medium">Model</th>
                      <th className="px-4 py-2 text-right font-medium">
                        Cores owed
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.outstanding.map((row, i) => (
                      <tr key={`${row.driver_name}-${row.model_code}-${i}`}>
                        <td className="px-4 py-2 text-gray-900">
                          {row.driver_name}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {row.model_code}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-red-600">
                          {row.cores_owed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number;
  accent: string;
  hint: string;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${accent}`}>{value}</div>
      <div className="mt-1 text-xs text-gray-400">{hint}</div>
    </div>
  );
}
