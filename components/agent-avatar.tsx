import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function AgentAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("")
  return (
    <Avatar className={className}>
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}
