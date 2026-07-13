import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PUBLIC_ROUTES = [
  "/login",
  "/api/auth",
  "/manager",
  "/api/auth-manager",
  "/driver",
  "/api/auth-driver",
];

const SIGNED_IN_ALLOWED = ["/onboarding", "/pending", "/api/signup"];

function hasValidManagerSession(
  req: Request & { cookies: { get: (n: string) => { value: string } | undefined } }
): boolean {
  const cookie = req.cookies.get("manager_session");
  if (!cookie?.value) return false;
  const parts = cookie.value.split(".");
  if (parts.length !== 3) return false;
  const expiry = Number(parts[1]);
  if (!Number.isFinite(expiry)) return false;
  return Date.now() < expiry;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ROUTES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const signedIn = Boolean(req.auth) || hasValidManagerSession(req);

  if (signedIn && SIGNED_IN_ALLOWED.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (signedIn) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$).*)"],
};
