// Guardrails for demo orgs: no outbound messages, capped AI usage.
import { isDemoOrg } from "@/lib/demo";
import { overLimit } from "@/lib/rate-limit";

export const DEMO_AI_PER_ORG_PER_DAY = 20;
export const DEMO_AI_GLOBAL_PER_DAY = 300;

// Demo orgs never send email or SMS.
export async function outboundAllowed(orgId: string | null | undefined): Promise<boolean> {
  return !(await isDemoOrg(orgId));
}

// Real orgs: always allowed. Demo orgs: per-org and global daily caps.
export async function aiAllowed(orgId: string | null | undefined): Promise<boolean> {
  if (!(await isDemoOrg(orgId))) return true;
  try {
    if (await overLimit(`ai:demo:org:${orgId}`, 60 * 24, DEMO_AI_PER_ORG_PER_DAY)) return false;
    if (await overLimit(`ai:demo:all`, 60 * 24, DEMO_AI_GLOBAL_PER_DAY)) return false;
    return true;
  } catch {
    return false; // fail closed for demos
  }
}
