import { getSessionCookie } from "better-auth/cookies"
import { type NextRequest, NextResponse } from "next/server"

// An optimistic check on the cookie alone; the session itself is verified in lib/dal.ts.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next()
  return NextResponse.redirect(new URL("/sign-in", request.url))
}

export const config = {
  matcher: ["/((?!api/auth|sign-in|sign-up|_next|favicon.ico).*)"],
}
