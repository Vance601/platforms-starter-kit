import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PUBLIC_ROUTES = [
  "/login",
  "/api/auth",
  "/manager/",
  "/api/auth-manager",
  "/forgot-password",
  "/reset-password",
  "/api/password-reset",
  "/driver/", // NOT bare "/driver" - that prefix also matched the admin /driver-sales page
  "/api/auth-driver",
  "/d/", // customer driver entry point: /d/<company>
];

// APIs the PIN-based driver app calls. Each verifies the driver_session
// signature itself; middleware only routes.
const DRIVER_APIS = [
  "/api/driver",
  "/api/transfer",
  "/api/battery/sellable",
  "/api/battery/loadable",
  "/api/battery/load",
  "/api/battery/sell",
  "/api/battery/return-core",
  "/api/battery/sold-list",
];

const SIGNED_IN_ALLOWED = ["/onboarding", "/pending", "/api/signup"];

type ReqWithCookies = Request & {
  cookies: { get: (n: string) => { value: string } | undefined };
};

// Cheap validity check only: 3 parts and not expired. The signature is verified
// inside each route with the server secret - middleware runs on the edge and
// only decides whether a request is worth passing through.
function hasValidSessionCookie(req: ReqWithCookies, name: string): boolean {
  const cookie = req.cookies.get(name);
  if (!cookie?.value) return false;
  const parts = cookie.value.split(".");
  if (parts.length !== 3) return false;
  const expiry = Number(parts[1]);
  if (!Number.isFinite(expiry)) return false;
  return Date.now() < expiry;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (
    pathname === "/driver" ||
    pathname === "/manager" ||
    PUBLIC_ROUTES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const r = req as unknown as ReqWithCookies;

  // Three session types, not two. Drivers sign in with a PIN and carry
  // driver_session - they have neither a NextAuth session nor manager_session.
  // Without this, every API the driver app calls (/api/driver/trucks,
  // /api/transfer, /api/battery/sellable, /api/battery/loadable,
  // /api/battery/sell, /api/battery/return-core, /api/battery/sold-list)
  // was redirected to /login. The page then parsed an HTML login page as JSON
  // and reported a generic load failure. It only appeared to work for the
  // owner, whose browser also holds a GitHub session.
  const staffSignedIn =
    Boolean(req.auth) || hasValidSessionCookie(r, "manager_session");
  // A driver session only opens the driver APIs - never admin pages/APIs.
  const driverAllowed =
    hasValidSessionCookie(r, "driver_session") &&
    DRIVER_APIS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const signedIn = staffSignedIn || driverAllowed;

  if (signedIn && SIGNED_IN_ALLOWED.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (signedIn) {
    return NextResponse.next();
  }

  // APIs get a JSON 401 instead of an HTML redirect, so pages can show
  // "please log in" instead of failing to parse a login page as JSON.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: "Not signed in. Please log in again." },
      { status: 401 }
    );
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$).*)"],
};
