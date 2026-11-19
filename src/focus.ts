// Remote-control navigation, modelled on BitChord TV (Compose focus groups):
//  - Zones: the top bar ([data-zone=bar]) and the visible page ([data-zone=page]). An open
//    layer ([data-layer]: Now Playing, a dialog) traps focus instead.
//  - Up from a page's top row lands on the bar's selected tab; Down from the bar returns to
//    where you were on the page.
//  - Rows ([data-row]) move by DOM order left/right and remember their last card.
//  - Scrolling is a transform on one track per page ([data-track]) and per row, so the GPU
//    moves already-painted layers instead of the main thread repainting on every frame.
//  - OK is handled here: a tap clicks on key-up, a hold (≥ 550 ms) fires `longpress`.
type Dir = 'left' | 'right' | 'up' | 'down'

const KEYS: Record<number, Dir> = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' }
const ENTER = 13
const LONG_PRESS_MS = 550

export function pickNext(from: DOMRect, cands: DOMRect[], dir: Dir): number {
  const cx = from.left + from.width / 2
  const cy = from.top + from.height / 2
  let best = -1
  let bestScore = Infinity
  const horizontal = dir === 'left' || dir === 'right'
  cands.forEach((r, i) => {
    const centerAhead = dir === 'left' ? cx - (r.left + r.width / 2) : dir === 'right' ? r.left + r.width / 2 - cx : dir === 'up' ? cy - (r.top + r.height / 2) : r.top + r.height / 2 - cy
    if (centerAhead <= 1) return
    const gap = dir === 'left' ? from.left - r.right : dir === 'right' ? r.left - from.right : dir === 'up' ? from.top - r.bottom : r.top - from.bottom
    // Distance off the travel axis; overlapping counts as in line.
    const off = horizontal ? Math.max(0, Math.max(r.top, from.top) - Math.min(r.bottom, from.bottom)) : Math.max(0, Math.max(r.left, from.left) - Math.min(r.right, from.right))
    const crossCenter = horizontal ? Math.abs(r.top + r.height / 2 - cy) : Math.abs(r.left + r.width / 2 - cx)
    const score = Math.max(0, gap) + off * 4 + crossCenter * 0.05
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  })
  return best
}

const isShown = (el: HTMLElement) => el.getClientRects().length > 0

function topLayer(): HTMLElement | null {
  const layers = document.querySelectorAll<HTMLElement>('[data-layer]')
  return layers.length ? layers[layers.length - 1] : null
}

const zoneOf = (el: Element | null) => (el ? (el.closest('[data-layer], [data-zone]') as HTMLElement | null) : null)

function visiblePage(): HTMLElement | null {
  const pages = document.querySelectorAll<HTMLElement>('[data-zone=page]')
  for (let i = pages.length - 1; i >= 0; i--) if (isShown(pages[i])) return pages[i]
  return null
}

export function focusables(root: ParentNode): HTMLElement[] {
  return (Array.prototype.slice.call(root.querySelectorAll('[data-f]')) as HTMLElement[]).filter(isShown)
}

// ---- Memory ---------------------------------------------------------------------------

const lastInRow = new WeakMap<Element, HTMLElement>()
const lastInZone = new WeakMap<Element, HTMLElement>()

function remember(el: HTMLElement) {
  const row = el.closest('[data-row]')
  if (row) lastInRow.set(row, el)
  const zone = zoneOf(el)
  if (zone) lastInZone.set(zone, el)
}

/** Focus a zone or layer: its remembered element, an [data-autofocus] one, or its first. */
export function enter(zone: HTMLElement | null): boolean {
  if (!zone) return false
  const last = lastInZone.get(zone)
  const el = (last && last.isConnected && isShown(last) && last) || zone.querySelector<HTMLElement>('[data-autofocus]') || focusables(zone)[0]
  if (!el) return false
  el.focus()
  return true
}

export function focusKey(key: string | null | undefined, root: ParentNode = document): boolean {
  if (!key) return false
  const el = root.querySelector<HTMLElement>(`[data-key="${key.replace(/"/g, '')}"]`)
  if (!el || !isShown(el)) return false
  el.focus()
  return true
}

/** Puts focus somewhere sensible when it is lost (screen change, element removed). */
export function ensureFocus() {
  const active = document.activeElement as HTMLElement | null
  const layer = topLayer()
  if (layer) {
    if (!active || !layer.contains(active)) enter(layer)
    return
  }
  if (active && active !== document.body && active.isConnected && isShown(active) && zoneOf(active)) return
  enter(visiblePage()) || enter(document.querySelector<HTMLElement>('[data-zone=bar]'))
}

// ---- Scrolling --------------------------------------------------------------------------

const BAR_SPACE = 150 // where a focused section's top rests, clear of the tab bar
const PEEK = 160 // the next card shows this much at a row's right edge

function px(el: HTMLElement, prop: '--x' | '--y') {
  return parseFloat(el.style.getPropertyValue(prop) || '0') || 0
}

function setTrack(el: HTMLElement, x: number, y: number) {
  el.style.setProperty('--x', x + 'px')
  el.style.setProperty('--y', y + 'px')
  el.style.transform = `translate3d(${x}px, ${y}px, 0)`
}

function reveal(el: HTMLElement) {
  const rowTrack = el.closest('[data-row]') as HTMLElement | null
  if (rowTrack && rowTrack.parentElement) {
    const view = rowTrack.parentElement.clientWidth
    const x = px(rowTrack, '--x')
    const left = el.offsetLeft
    const right = left + el.offsetWidth
    let nx = x
    if (left + x < 0) nx = -left
    else if (right + x > view - PEEK) nx = Math.min(0, view - PEEK - right)
    if (nx !== x) setTrack(rowTrack, nx, 0)
  }
  const track = el.closest('[data-track]') as HTMLElement | null
  if (track && track.parentElement) {
    const view = track.parentElement.clientHeight
    const section = (el.closest('[data-sec]') as HTMLElement | null) || el
    const tr = track.getBoundingClientRect()
    const sr = section.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    const y = px(track, '--y')
    const max = Math.max(0, track.scrollHeight - view + 80)
    let ny = y
    if (sr.height < view - BAR_SPACE - 60) ny = -(sr.top - tr.top) + BAR_SPACE
    else if (er.top < BAR_SPACE) ny = y + (BAR_SPACE - er.top)
    else if (er.bottom > view - 80) ny = y - (er.bottom - (view - 80))
    ny = Math.min(0, Math.max(-max, ny))
    // The first section keeps the page at its top, under the bar.
    if (sr.top - tr.top < BAR_SPACE + 40) ny = 0
    if (ny !== y) setTrack(track, 0, ny)
    document.documentElement.classList.toggle('scrolled', ny < 0)
  }
}

/** Puts a page back at its top (used when the bar takes focus, as BitChord does). */
export function scrollPageTop(page: HTMLElement | null) {
  const track = page && page.querySelector<HTMLElement>('[data-track]')
  if (track) setTrack(track, 0, 0)
  document.documentElement.classList.remove('scrolled')
}

// ---- Moving -------------------------------------------------------------------------------

function sameRowNeighbour(active: HTMLElement, dir: Dir): HTMLElement | null | undefined {
  const row = active.closest('[data-row]')
  if (!row || (dir !== 'left' && dir !== 'right')) return undefined
  const items = focusables(row)
  const i = items.indexOf(active)
  return items[i + (dir === 'right' ? 1 : -1)] || null
}

export function move(dir: Dir): boolean {
  const active = document.activeElement as HTMLElement | null
  const layer = topLayer()
  const zone = layer || zoneOf(active)
  if (!active || !zone || !zone.contains(active) || (layer && !layer.contains(active))) {
    ensureFocus()
    return true
  }
  const inRow = sameRowNeighbour(active, dir)
  if (inRow) {
    inRow.focus()
    return true
  }
  const others = focusables(zone).filter((el) => el !== active && (inRow === undefined || el.closest('[data-row]') !== active.closest('[data-row]')))
  const i = pickNext(active.getBoundingClientRect(), others.map((el) => el.getBoundingClientRect()), dir)
  if (i >= 0) {
    let target = others[i]
    const toRow = target.closest('[data-row]')
    if ((dir === 'up' || dir === 'down') && toRow && toRow !== active.closest('[data-row]')) {
      const mem = lastInRow.get(toRow)
      if (mem && mem.isConnected && isShown(mem)) target = mem
    }
    target.focus()
    return true
  }
  if (layer) return false
  const name = zone.getAttribute('data-zone')
  if (name === 'page' && dir === 'up') {
    const bar = document.querySelector<HTMLElement>('[data-zone=bar]')
    const tab = bar && bar.querySelector<HTMLElement>('[data-selected]')
    scrollPageTop(zone)
    if (tab) tab.focus()
    else enter(bar)
    return true
  }
  if (name === 'bar' && dir === 'down') {
    // Down from the bar enters the page at its top, never a row remembered from further down.
    const page = visiblePage()
    const first = page && (page.querySelector<HTMLElement>('[data-autofocus]') || focusables(page)[0])
    if (first) first.focus()
    return !!first
  }
  return false
}

// ---- Keys ---------------------------------------------------------------------------------

let pressAt = 0
let pressTarget: HTMLElement | null = null
let longFired = false

let installed = false

export function installFocus(onBack: () => void, onKey: (e: KeyboardEvent) => boolean) {
  // Once only: a second set of listeners would move focus two steps per press.
  if (installed) return
  installed = true
  document.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement
    remember(el)
    reveal(el)
  })
  document.addEventListener('keydown', (e) => {
    if (onKey(e)) return e.preventDefault()
    if (e.keyCode === ENTER) {
      e.preventDefault()
      const el = document.activeElement as HTMLElement | null
      if (!el || !el.hasAttribute('data-f')) return
      if (!e.repeat || pressTarget !== el) {
        pressAt = Date.now()
        pressTarget = el
        longFired = false
      } else if (!longFired && Date.now() - pressAt >= LONG_PRESS_MS) {
        longFired = true
        el.dispatchEvent(new CustomEvent('longpress', { bubbles: true }))
      }
      return
    }
    // 10009 = Tizen Return; Escape/Backspace when testing in a browser.
    if (e.keyCode === 10009 || e.keyCode === 27 || e.keyCode === 8) {
      e.preventDefault()
      return onBack()
    }
    const dir = KEYS[e.keyCode]
    if (!dir) return
    e.preventDefault()
    move(dir)
  })
  document.addEventListener('keyup', (e) => {
    if (e.keyCode !== ENTER) return
    e.preventDefault()
    const el = pressTarget
    pressTarget = null
    if (el && !longFired && el === document.activeElement) el.click()
  })
}
