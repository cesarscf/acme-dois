"use client"

import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react"
import { useTransition } from "react"
import { signOut } from "@/app/(auth)/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

type User = { name: string; email: string }

const Initial = ({ name, className }: { name: string; className?: string }) => (
  <span
    className={`grid size-10 shrink-0 place-items-center rounded-full bg-soft text-[15px] font-semibold text-sub ${className ?? ""}`}
  >
    {name.trim().charAt(0).toUpperCase()}
  </span>
)

const Who = ({ user, className }: { user: User; className?: string }) => (
  <span className={`grid min-w-0 flex-1 text-left leading-tight ${className ?? ""}`}>
    <span className="truncate text-[14px] font-medium">{user.name}</span>
    <span className="truncate text-[12px] text-muted-foreground">{user.email}</span>
  </span>
)

// Who is signed in, at the foot of the list, as shadcn's nav-user: a menu with Sair.
export function NavUser({ user }: { user: User }) {
  const [leaving, startLeaving] = useTransition()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                // As large as the agents' avatars above it, and where they are, collapsed or not.
                className="h-auto gap-3 py-2 data-popup-open:bg-sidebar-accent group-data-[collapsible=icon]:h-auto! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:px-3! group-data-[collapsible=icon]:py-2!"
              />
            }
          >
            <Initial name={user.name} />
            <Who user={user} className="group-data-[collapsible=icon]:hidden" />
            <ChevronsUpDownIcon className="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-(--anchor-width) min-w-60">
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <Initial name={user.name} />
              <Who user={user} />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={leaving} onClick={() => startLeaving(() => signOut())}>
              <LogOutIcon />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
