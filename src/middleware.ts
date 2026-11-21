import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Protected paths requiring login
  const isProtectedPath =
    path.startsWith("/dashboard") ||
    path.startsWith("/ingredients") ||
    path.startsWith("/stock") ||
    path.startsWith("/menus") ||
    path.startsWith("/reports") ||
    path.startsWith("/users");

  const session = request.cookies.get("naysin_username_session")?.value;

  if (isProtectedPath && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(loginUrl);
  }

  // Let /login render even if a cookie exists; dashboard validates the JWT and DB role.

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/ingredients/:path*",
    "/stock/:path*",
    "/menus/:path*",
    "/reports/:path*",
    "/users/:path*",
    "/login",
  ],
};

