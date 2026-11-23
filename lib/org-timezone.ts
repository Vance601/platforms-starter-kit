import { getOrgSettings } from "@/lib/org-settings";
import { DEFAULT_BUSINESS_TIMEZONE } from "@/lib/org-day-range";

/** Organization business timezone, or America/Phoenix when none is stored. */
export async function orgTimezone(orgId: string | null | undefined): Promise<string> {
  if (!orgId) return DEFAULT_BUSINESS_TIMEZONE;
  const settings = await getOrgSettings(orgId);
  return settings.timezone || DEFAULT_BUSINESS_TIMEZONE;
}
