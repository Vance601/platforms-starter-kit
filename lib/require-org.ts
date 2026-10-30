// lib/require-org.ts
// Shared guard for staff (owner/manager) API routes.
// Every staff route must know WHICH organization the caller belongs to and
// scope its queries by it. Usage:
//
//   const g = await requireOrg();                 // any signed-in staff user
//   const g = await requireOrg({ roles: ["owner", "manager"] });
//   if (!g.ok) return g.response;
//   ... WHERE company_id IN (SELECT id FROM companies WHERE org_id = ${g.orgId})
//
// Driver (PIN) routes do NOT use this; they verify driver_session and scope by
// the driver's company_id.
import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/lib/current-user";

export type OrgGuard =
  | { ok: true; user: CurrentUser; orgId: string }
  | { ok: false; response: NextResponse };

export async function requireOrg(opts: { roles?: string[] } = {}): Promise<OrgGuard> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 }),
    };
  }
  if (opts.roles && !opts.roles.includes(user.role ?? "")) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 }),
    };
  }
  if (!user.orgId) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Your account is not linked to an organization yet." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, user, orgId: user.orgId };
}
