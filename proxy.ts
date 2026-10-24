import { getSessionCookie } from "better-auth/cookies"
import { type NextRequest, NextResponse } from "next/server"

// An optimistic check on the cookie alone; the session itself is verified in lib/dal.ts.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next()
  return NextResponse.redirect(new URL("/sign-in", request.url))
}

export const config = {
  // Invite links open for anyone; the page itself sends them to sign in.
  matcher: ["/((?!api/auth|sign-in|sign-up|invites|_next|favicon.ico).*)"],
}
