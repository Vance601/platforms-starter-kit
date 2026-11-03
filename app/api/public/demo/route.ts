// POST: one-click demo. Creates an isolated demo org (expires in 7 days) with
// fake Las Vegas data and signs the visitor in as its owner.
import { NextRequest, NextResponse } from "next/server";
import { createDemoOrg, liveDemoOwner } from "@/lib/demo";
import { setManagerSession, verifyManagerSession, requestHost } from "@/lib/manager-session";
import { overLimit, clientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const resume = (userId: string) => {
      const res = NextResponse.json({ success: true, redirect: "/", resumed: true });
      setManagerSession(res, userId, 60 * 60 * 24, requestHost(req));
      return res;
    };
    // 1) Already holding a valid session for a live demo: just continue it.
    const sessUser = verifyManagerSession(req.cookies.get("manager_session")?.value);
    if (sessUser) {
      const owner = await liveDemoOwner({ userId: sessUser });
      if (owner) return resume(owner);
    }
    // 2) Per-IP limit hit: reuse this IP's most recent live demo if any.
    if (await overLimit(`demo:ip:${ip}`, 60, 5)) {
      const owner = await liveDemoOwner({ ip });
      if (owner) return resume(owner);
      return NextResponse.json({ success: false, error: "You've started several demos recently. Please try again in an hour." }, { status: 429 });
    }
    if (await overLimit("demo:all", 60 * 24, 200)) {
      const owner = await liveDemoOwner({ ip });
      if (owner) return resume(owner);
      return NextResponse.json({ success: false, error: "The demo is very busy today. Please sign up instead or try again tomorrow." }, { status: 429 });
    }
    const demo = await createDemoOrg(ip);
    await logAudit({ action: "demo.created", actorType: "manager", actorId: demo.userId, orgId: demo.orgId, entityType: "organization", entityId: demo.orgId, req });
    const res = NextResponse.json({ success: true, redirect: "/" });
    setManagerSession(res, demo.userId, 60 * 60 * 24, requestHost(req));
    return res;
  } catch (err) {
    console.error("[demo] create failed", err);
    return NextResponse.json({ success: false, error: "Could not create the demo right now. Please try again." }, { status: 500 });
  }
}
