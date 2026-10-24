"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { useConversations } from "@/components/conversations"

// How often an open page looks for messages the member didn't ask for, such as an agent telling
// them a colleague changed one of their sessions.
const every = 15_000

// Refreshes the page from the server while the member can see it, and as soon as they come back to
// it. Not while an agent answers them: the reply refreshes the page itself.
export function LiveRefresh() {
  const router = useRouter()
  const pathname = usePathname()
  const { working } = useConversations()
  const answering = working.size > 0

  // A conversation opens at once from what the list prefetched or the member saw a moment ago, and
  // then catches up with the server in the background, as WhatsApp does.
  const opened = useRef(pathname)
  useEffect(() => {
    if (opened.current === pathname) return
    opened.current = pathname
    router.refresh()
  }, [router, pathname])

  useEffect(() => {
    if (answering) return
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh()
    }
    const timer = setInterval(refresh, every)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [router, answering])

  return null
}
