import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

// On a phone, a conversation fills the screen and this goes back to the list, as on WhatsApp.
export function BackToList() {
  return (
    <Link
      href="/"
      aria-label="Voltar para as conversas"
      className="-ml-1 grid size-9 shrink-0 place-items-center rounded-full text-ink hover:bg-soft md:hidden"
    >
      <ArrowLeftIcon className="size-5" />
    </Link>
  )
}
