// Verifies the driver_session cookie (same format as /api/auth-driver issues)
// and loads the driver, their company's org, and their claimed truck.
import crypto from "crypto";
import { sql } from "@vercel/postgres";
import type { NextRequest } from "next/server";

export function verifyDriverToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [driverId, expiryStr, sig] = parts;
  const secret = process.env.MIGRATE_SECRET || "";
  const expected = crypto.scryptSync(`${driverId}.${expiryStr}`, secret, 32).toString("hex");
  if (sig !== expected) return null;
  if (Date.now() > Number(expiryStr)) return null;
  return driverId;
}

export type DriverContext = {
  driverId: string;
  name: string;
  companyId: string;
  orgId: string | null;
  truckId: string | null;
};

export async function getDriverContext(req: NextRequest): Promise<DriverContext | null> {
  const driverId = verifyDriverToken(req.cookies.get("driver_session")?.value);
  if (!driverId) return null;
  const { rows } = await sql`
    SELECT d.id, d.name, d.company_id, c.org_id
    FROM drivers d LEFT JOIN companies c ON c.id = d.company_id
    WHERE d.id = ${driverId} AND d.active = TRUE LIMIT 1;
  `;
  if (!rows[0]) return null;
  const { rows: t } = await sql`SELECT id FROM trucks WHERE current_driver_id = ${driverId} LIMIT 1;`;
  return {
    driverId,
    name: rows[0].name,
    companyId: rows[0].company_id,
    orgId: rows[0].org_id == null ? null : String(rows[0].org_id),
    truckId: t[0]?.id ?? null,
  };
}
