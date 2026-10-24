// The mascots come alive as AbacatePay's marketplace bots do: their eyes follow the pointer for a
// moment after it moves, then wander; they blink now and then, sometimes twice; and while the element
// marked data-bot-hover around them is hovered or focused from the keyboard they turn happy, with a
// move picked at random: a hop, a dance, a squish or a spring. One animation frame drives every bot
// on screen, and none moves for whoever prefers reduced motion.

export type BotMood = "idle" | "happy"

// What a happy mascot does: hop, dance, get squished or spring up (globals.css draws each).
const moves = ["hop", "dance", "squish", "spring"] as const

function pickMove(rand: () => number, last?: string) {
  const choices = moves.filter((move) => move !== last)
  return choices[Math.floor(rand() * choices.length)]
}

type Bot = {
  el: SVGSVGElement
  rand: () => number
  visible: boolean
  // Where the eyes look now and where they are headed, from -1 to 1.
  lx: number
  ly: number
  tx: number
  ty: number
  nextLook: number
  nextBlink: number
  blinkEnd: number
  written: string
}

const bots = new Set<Bot>()
const byElement = new Map<Element, Bot>()
const pointer = { x: 0, y: 0, at: -Infinity }
let frame = 0
let observer: IntersectionObserver | undefined

// How long the eyes follow the pointer after it last moved, and how long a blink lasts.
const followFor = 2500
const blinkFor = 140

// The same seed always gives the same bot its own rhythm.
function seeded(seed: string) {
  let state = 2166136261
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619)
  return () => {
    state = (state + 1831565813) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerType !== "mouse") return
  pointer.x = event.clientX
  pointer.y = event.clientY
  pointer.at = performance.now()
  wake()
}

function step(bot: Bot, now: number) {
  if (now - pointer.at < followFor) {
    const box = bot.el.getBoundingClientRect()
    const dx = pointer.x - (box.left + box.width / 2)
    const dy = pointer.y - (box.top + box.height / 2)
    const distance = Math.hypot(dx, dy) || 1
    const reach = Math.min(1, distance / 240)
    bot.tx = (dx / distance) * reach
    bot.ty = (dy / distance) * reach
  } else if (now > bot.nextLook) {
    const ahead = bot.rand() < 0.4
    bot.tx = ahead ? 0 : bot.rand() * 2 - 1
    bot.ty = ahead ? 0 : bot.rand() * 1.2 - 0.5
    bot.nextLook = now + 1200 + bot.rand() * 2800
  }
  bot.lx += (bot.tx - bot.lx) * 0.16
  bot.ly += (bot.ty - bot.ly) * 0.16
  if (now > bot.nextBlink) {
    bot.blinkEnd = now + blinkFor
    bot.nextBlink = now + (bot.rand() < 0.2 ? 260 : 1800 + bot.rand() * 4200)
  }
  const blink = now < bot.blinkEnd ? 0.1 : 1
  const written = `${bot.lx.toFixed(3)}|${bot.ly.toFixed(3)}|${blink}`
  if (written === bot.written) return
  bot.written = written
  bot.el.style.setProperty("--lx", bot.lx.toFixed(3))
  bot.el.style.setProperty("--ly", bot.ly.toFixed(3))
  bot.el.style.setProperty("--blink", String(blink))
}

function tick(now: number) {
  frame = 0
  let any = false
  for (const bot of bots) {
    if (!bot.visible) continue
    any = true
    step(bot, now)
  }
  if (any) frame = requestAnimationFrame(tick)
}

function wake() {
  if (!frame && bots.size) frame = requestAnimationFrame(tick)
}

function watch(el: Element) {
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const bot = byElement.get(entry.target)
      if (bot) bot.visible = entry.isIntersecting
    }
    wake()
  })
  observer.observe(el)
}

// Brings a mascot to life until the returned function is called. `mood` holds it in one mood;
// `greet` makes it happy for a moment as it appears.
export function animateBot(el: SVGSVGElement, { seed, mood, greet = false }: { seed: string; mood?: BotMood; greet?: boolean }) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {}
  const rand = seeded(seed)
  const now = performance.now()
  const bot: Bot = {
    el,
    rand,
    visible: false,
    lx: 0,
    ly: 0,
    tx: 0,
    ty: 0,
    nextLook: now + rand() * 1500,
    nextBlink: now + 600 + rand() * 3000,
    blinkEnd: 0,
    written: "",
  }
  // Each breathes at its own pace, and not all in step.
  const breathe = 2.6 + rand() * 1.4
  el.style.setProperty("--bot-breathe", `${breathe.toFixed(2)}s`)
  el.style.setProperty("--bot-delay", `${(-rand() * breathe).toFixed(2)}s`)

  if (bots.size === 0) addEventListener("pointermove", onPointerMove, { passive: true })
  bots.add(bot)
  byElement.set(el, bot)
  watch(el)

  // What it reacts to: the element marked data-bot-hover around it, or else the mascot itself, so
  // every mascot in the app turns happy under the pointer.
  const host = el.closest("[data-bot-hover]") ?? el
  // Each time it turns happy, it picks one of its moves, never the same twice in a row.
  const feel = (felt: BotMood) => {
    const next = mood ?? felt
    if (next === "happy" && el.dataset.mood !== "happy") el.dataset.move = pickMove(rand, el.dataset.move)
    el.dataset.mood = next
  }
  const happy = () => feel("happy")
  const idle = () => feel("idle")
  // Focus counts only from the keyboard: a click leaves it on what was clicked, and the mascot
  // would hop until the member clicked elsewhere.
  const focused = (event: Event) => {
    if ((event.target as Element).matches(":focus-visible")) happy()
  }
  host.addEventListener("pointerenter", happy)
  host.addEventListener("pointerleave", idle)
  host.addEventListener("focusin", focused)
  host.addEventListener("focusout", idle)
  feel("idle")
  let greeting: ReturnType<typeof setTimeout> | undefined
  if (greet) {
    feel("happy")
    greeting = setTimeout(idle, 1400)
  }

  return () => {
    clearTimeout(greeting)
    host.removeEventListener("pointerenter", happy)
    host.removeEventListener("pointerleave", idle)
    host.removeEventListener("focusin", focused)
    host.removeEventListener("focusout", idle)
    observer?.unobserve(el)
    bots.delete(bot)
    byElement.delete(el)
    if (bots.size === 0) {
      removeEventListener("pointermove", onPointerMove)
      cancelAnimationFrame(frame)
      frame = 0
    }
  }
}
