import { NextRequest, NextResponse } from "next/server";
import {
  buildDailyMovementsReport,
  dailyMovementsToCsv,
  parseReportDate,
} from "@/lib/daily-movements-report";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily incoming / sold / cores / transfers report for the morning tracker.
// Protected by CRON_SECRET (Authorization: Bearer <CRON_SECRET>), same as
// /api/cron/demo-cleanup. SELECT-only; never writes stock or sales data.
//
//   GET /api/reports/daily-movements?org=<slug-or-id>&date=YYYY-MM-DD
//   GET /api/reports/daily-movements?org=duggers&date=YYYY-MM-DD&format=csv
//
// org may be an organization slug or id, a company slug (phx, abq, tucson),
// or "duggers". Omit org to return every non-demo org. date defaults to
// yesterday in the org's timezone (America/Phoenix for Duggers).

function cronAuthorized(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = (req.headers.get("authorization") || "").trim();
  return !!secret && auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl;
  const orgParam = url.searchParams.get("org") || url.searchParams.get("orgId") || url.searchParams.get("orgSlug");
  const dateRaw = url.searchParams.get("date");
  const dateYmd = parseReportDate(dateRaw);
  if (dateRaw && !dateYmd) {
    return NextResponse.json({ success: false, error: "date must be YYYY-MM-DD." }, { status: 400 });
  }
  const includeDemo = url.searchParams.get("includeDemo") === "1";
  const format = (url.searchParams.get("format") || "json").toLowerCase();

  try {
    const result = await buildDailyMovementsReport({
      orgParam: orgParam && orgParam.trim() ? orgParam.trim() : null,
      dateYmd,
      includeDemo,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    if (format === "csv") {
      const csv = dailyMovementsToCsv(result);
      const datePart = result.reports[0]?.date || "report";
      const orgPart = result.reports.length === 1 ? result.reports[0].org.slug || "org" : "all-orgs";
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="daily-movements-${orgPart}-${datePart}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const body =
      result.reports.length === 1
        ? {
            success: true,
            generatedAt: result.generatedAt,
            ...result.reports[0],
            orgs: result.orgs,
          }
        : {
            success: true,
            generatedAt: result.generatedAt,
            orgs: result.orgs,
            reports: result.reports,
          };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[daily-movements] failed", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
