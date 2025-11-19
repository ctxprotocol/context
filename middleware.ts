import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  const session = await auth();

  // Allow API routes for auth to pass through
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // If user is not authenticated and trying to access a specific chat,
  // redirect them back to the main chat shell instead of the login page.
  // The login flow now lives inside the chat UI itself.
  if (!session && pathname.startsWith("/chat/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If user is authenticated and tries to access login/register, redirect to home
  if (session && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/chat/:id*",
    "/login",
    "/register",
    "/((?!_next/static|_next/image|favicon.ico|api/auth/guest).*)",
  ],
};
