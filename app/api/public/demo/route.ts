// POST: one-click demo. Creates an isolated demo org (expires in 7 days) with
// fake Las Vegas data and signs the visitor in as its owner.
import { NextRequest, NextResponse } from "next/server";
import { createDemoOrg } from "@/lib/demo";
import { setManagerSession } from "@/lib/manager-session";
import { overLimit, clientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    if (await overLimit(`demo:ip:${ip}`, 60, 3)) {
      return NextResponse.json({ success: false, error: "You've started several demos recently. Please try again in an hour." }, { status: 429 });
    }
    if (await overLimit("demo:all", 60 * 24, 200)) {
      return NextResponse.json({ success: false, error: "The demo is very busy today. Please sign up instead or try again tomorrow." }, { status: 429 });
    }
    const demo = await createDemoOrg();
    await logAudit({ action: "demo.created", actorType: "manager", actorId: demo.userId, orgId: demo.orgId, entityType: "organization", entityId: demo.orgId, req });
    const res = NextResponse.json({ success: true, redirect: "/" });
    setManagerSession(res, demo.userId, 60 * 60 * 24);
    return res;
  } catch (err) {
    console.error("[demo] create failed", err);
    return NextResponse.json({ success: false, error: "Could not create the demo right now. Please try again." }, { status: 500 });
  }
}
