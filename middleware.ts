import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/api/auth", "/api/migrate", "/api/seed", "/api/make-owner", "/manager", "/api/auth-manager", "/driver", "/api/auth-driver"];

// A manager_session cookie looks like "userId.expiry.signature".
// Edge-safe check: confirm it's well-formed and not past its expiry.
// (The login route signs it with MIGRATE_SECRET; pages can re-verify if needed.)
function hasValidManagerSession(req: Request & { cookies: { get: (n: string) => { value: string } | undefined } }): boolean {
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

  // Allow GitHub-authenticated users (owner) OR a valid manager session.
  if (req.auth || hasValidManagerSession(req)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$).*)"],
};
