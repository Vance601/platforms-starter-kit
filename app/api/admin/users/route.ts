// Org user management. Everything is scoped to the caller's organization.
// GET  -> users in the caller's org (never password_hash) + who may manage.
// POST { action, ... } (owner/admin only):
//   create     { name, login, role, mode: "temp" | "invite" }
//   update     { userId, name, login, role }
//   reset      { userId, newPassword? , generate?: true }   (legacy body without action = reset)
//   deactivate { userId } / reactivate { userId }
//   remove     { userId }
// Rules: only an owner may touch an owner or grant "owner"; the last active
// owner/admin can't be demoted, deactivated or removed; you can't remove or
// deactivate yourself. Every change is written to the audit log.
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { randomBytes, randomUUID } from "crypto";
import { getCurrentUser, type CurrentUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";
import { hashPassword, ensureResetTable, hashToken } from "@/lib/password-reset";
import { outboundAllowed } from "@/lib/demo-guard";
import {
  ASSIGNABLE_ROLES, MANAGER_ROLES, ensureUserAdminSchema, loginTaken,
  normalizeLogin, otherActiveAdmins, tempPassword,
} from "@/lib/user-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const INVITE_DAYS = 7;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

async function gate(manage: boolean): Promise<{ user: CurrentUser & { orgId: string } } | { res: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { res: bad("Not signed in.", 401) };
  const r = user.dbRole ?? "";
  const allowed = manage ? MANAGER_ROLES.includes(r) : [...MANAGER_ROLES, "manager"].includes(r);
  if (!allowed) return { res: bad("Only an owner or admin can manage users.", 403) };
  if (!user.orgId) return { res: bad("Your account has no organization.", 403) };
  return { user: user as CurrentUser & { orgId: string } };
}

async function actorName(id: string): Promise<string | null> {
  const { rows } = await sql`SELECT name FROM users WHERE id = ${id} LIMIT 1;`;
  return (rows[0]?.name as string) ?? null;
}

function baseUrl(req: NextRequest): string {
  const env = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
  if (env) return env.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "www.battery-city.com";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export async function GET() {
  try {
    const g = await gate(false);
    if ("res" in g) return g.res;
    await ensureUserAdminSchema();
    const { rows } = await sql`
      SELECT id, name, email, role::text AS role, status::text AS status,
             (password_hash IS NOT NULL) AS has_password, must_change_password
      FROM users
      WHERE org_id = ${g.user.orgId} AND status::text <> 'terminated'
      ORDER BY CASE role::text WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END,
               lower(coalesce(name, email));
    `;
    return NextResponse.json({
      success: true,
      me: g.user.userId,
      myRole: g.user.dbRole,
      canManage: MANAGER_ROLES.includes(g.user.dbRole ?? ""),
      users: rows,
    });
  } catch (err: unknown) {
    return bad(err instanceof Error ? err.message : "Unknown error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await gate(true);
    if ("res" in g) return g.res;
    await ensureUserAdminSchema();
    const me = g.user;
    const orgId = me.orgId;
    const isOwner = me.dbRole === "owner";
    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "reset";
    const name = await actorName(me.userId);
    const audit = (a: string, entityId: string, details: Record<string, unknown>) =>
      logAudit({ action: a, actorType: "manager", actorId: me.userId, actorName: name, orgId, entityType: "user", entityId, details, req });

    const roleOk = (role: string) =>
      (ASSIGNABLE_ROLES as readonly string[]).includes(role) || (role === "owner" && isOwner);

    // ---------- create ----------
    if (action === "create") {
      const fullName = String(body.name ?? "").trim().slice(0, 120);
      if (!fullName) return bad("Enter the person's name.");
      const login = normalizeLogin(body.login);
      if (!login.ok) return bad(login.error);
      const role = String(body.role ?? "");
      if (!roleOk(role)) return bad("Pick a role: admin, manager or driver.");
      if (await loginTaken(login.value)) return bad("That email or username is already in use.");

      const wantInvite = body.mode === "invite";
      if (wantInvite && !login.value.includes("@")) return bad("An invite needs an email address. Use a temporary password for usernames.");
      const canEmail = wantInvite && (await outboundAllowed(orgId)) && !!process.env.RESEND_API_KEY;

      const id = randomUUID();
      const temp = canEmail ? null : tempPassword();
      await sql`
        INSERT INTO users (id, name, email, role, status, org_id, password_hash, must_change_password)
        VALUES (${id}, ${fullName}, ${login.value}, ${role}, 'active', ${orgId},
                ${temp ? hashPassword(temp) : null}, ${temp ? true : false});`;
      await sql`
        INSERT INTO user_companies (user_id, company_id)
        SELECT ${id}, id FROM companies WHERE org_id = ${orgId}
        ON CONFLICT DO NOTHING;`;

      let invited = false;
      if (canEmail) {
        await ensureResetTable();
        const token = randomBytes(32).toString("hex");
        await sql`
          INSERT INTO password_reset_tokens (user_id, email, token_hash, expires_at)
          VALUES (${id}, ${login.value}, ${hashToken(token)}, NOW() + make_interval(days => ${INVITE_DAYS}));`;
        const link = `${baseUrl(req)}/reset-password?token=${token}`;
        const safe = (s: string) => s.replace(/[<>&]/g, "");
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "Battery City <no-reply@battery-city.com>",
            to: [login.value],
            subject: "You're invited to Battery City",
            text: `Hi ${fullName},\n\n${name || "Your team"} added you to Battery City as ${role}.\n\nSet your password here (link works for ${INVITE_DAYS} days, one time only):\n${link}\n\nThen sign in at ${baseUrl(req)}/login with ${login.value}.`,
            html: `<p>Hi ${safe(fullName)},</p><p>${safe(name || "Your team")} added you to Battery City as ${role}.</p><p><a href="${link}">Set your password</a> - this link works for ${INVITE_DAYS} days, one time only.</p><p>Then sign in at ${baseUrl(req)}/login with ${safe(login.value)}.</p>`,
          }),
        });
        invited = resp.ok;
        if (!resp.ok) console.error("[admin/users] invite email failed", resp.status, await resp.text().catch(() => ""));
      }
      // Invite failed to send: fall back to a temporary password shown once.
      let shownTemp = temp;
      if (canEmail && !invited) {
        shownTemp = tempPassword();
        await sql`UPDATE users SET password_hash = ${hashPassword(shownTemp)}, must_change_password = true WHERE id = ${id} AND org_id = ${orgId};`;
      }
      await audit("user.created", id, { login: login.value, role, method: invited ? "invite_email" : "temp_password", inviteSkipped: wantInvite && !canEmail });
      return NextResponse.json({
        success: true,
        user: { id, name: fullName, email: login.value, role },
        invited,
        tempPassword: shownTemp ?? undefined,
        note: wantInvite && !invited
          ? (await outboundAllowed(orgId)) ? "Invite email could not be sent, so a temporary password was made instead." : "Demo organizations don't send email, so a temporary password was made instead."
          : undefined,
      });
    }

    // ---------- everything else targets an existing user in this org ----------
    const userId = String(body.userId ?? "");
    if (!userId) return bad("No user selected.");
    const { rows } = await sql`
      SELECT id, name, email, role::text AS role, status::text AS status FROM users
      WHERE id = ${userId} AND org_id = ${orgId} LIMIT 1;`;
    const t = rows[0];
    if (!t) return bad("User not found in your organization.", 404);
    if (t.role === "owner" && !isOwner) return bad("Only an owner can change an owner's account.", 403);
    const isAdminish = ["owner", "admin"].includes(t.role) && t.status === "active";
    const lastAdmin = isAdminish && (await otherActiveAdmins(orgId, t.id)) === 0;

    if (action === "update") {
      const fullName = String(body.name ?? t.name ?? "").trim().slice(0, 120);
      if (!fullName) return bad("Name can't be empty.");
      const login = normalizeLogin(body.login ?? t.email);
      if (!login.ok) return bad(login.error);
      const role = String(body.role ?? t.role);
      if (role !== t.role) {
        if (!roleOk(role)) return bad("Pick a role: admin, manager or driver.");
        if (lastAdmin && !["owner", "admin"].includes(role)) return bad("This is the last owner/admin. Add another admin before changing this role.");
      }
      if (login.value !== String(t.email).toLowerCase() && (await loginTaken(login.value, t.id))) {
        return bad("That email or username is already in use.");
      }
      await sql`UPDATE users SET name = ${fullName}, email = ${login.value}, role = ${role} WHERE id = ${t.id} AND org_id = ${orgId};`;
      await audit("user.updated", t.id, {
        before: { name: t.name, login: t.email, role: t.role },
        after: { name: fullName, login: login.value, role },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "reset") {
      const generated = body.generate === true;
      const pw = generated ? tempPassword() : String(body.newPassword ?? "");
      if (pw.length < 8) return bad("Password must be at least 8 characters.");
      // Someone else's password: they must change it at next sign-in.
      const mustChange = t.id !== me.userId;
      await sql`UPDATE users SET password_hash = ${hashPassword(pw)}, must_change_password = ${mustChange} WHERE id = ${t.id} AND org_id = ${orgId};`;
      await audit("password.admin_reset", t.id, { generated, mustChange });
      return NextResponse.json({
        success: true,
        user: { id: t.id, name: t.name, email: t.email },
        tempPassword: generated ? pw : undefined,
      });
    }

    if (action === "deactivate" || action === "remove") {
      if (t.id === me.userId) return bad(`You can't ${action} your own account.`);
      if (lastAdmin) return bad(`This is the last owner/admin. Add another admin before you ${action} this user.`);
      if (action === "deactivate") {
        await sql`UPDATE users SET status = 'inactive' WHERE id = ${t.id} AND org_id = ${orgId};`;
        await audit("user.deactivated", t.id, { login: t.email });
        return NextResponse.json({ success: true });
      }
      // Remove: keep the row so history (sales, audit) still resolves, but end
      // access for good, hide it from the list and free the login name.
      const freed = `removed-${t.id.slice(0, 8)}-${Date.now()}@removed.invalid`;
      await sql`UPDATE users SET status = 'terminated', password_hash = NULL, email = ${freed} WHERE id = ${t.id} AND org_id = ${orgId};`;
      await sql`DELETE FROM user_companies WHERE user_id = ${t.id};`;
      await audit("user.removed", t.id, { login: t.email, name: t.name });
      return NextResponse.json({ success: true });
    }

    if (action === "reactivate") {
      await sql`UPDATE users SET status = 'active' WHERE id = ${t.id} AND org_id = ${orgId};`;
      await audit("user.reactivated", t.id, { login: t.email });
      return NextResponse.json({ success: true });
    }

    return bad("Unknown action.");
  } catch (err: unknown) {
    return bad(err instanceof Error ? err.message : "Unknown error", 500);
  }
}
