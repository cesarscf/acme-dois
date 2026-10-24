"use client"

type Props = { suggestions: string[]; onSelect: (text: string) => void }

export function Suggestions({ suggestions, onSelect }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          className="h-9 rounded-full border border-line bg-surface px-4 text-[14px] font-semibold text-ink hover:bg-soft"
        >
          {suggestion}
        </button>
      ))}
    </div>
  )
}
