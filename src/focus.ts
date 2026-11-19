// Spatial navigation for the remote. Focusable elements carry [data-f].
// Arrows jump to the nearest one in that direction; entering a horizontal row ([data-row])
// returns to the card last focused in it, like Apple TV. Rows and the page scroll to keep focus in view.
type Dir = 'left' | 'right' | 'up' | 'down'

const KEYS: Record<number, Dir> = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' }

export function pickNext(from: DOMRect, cands: DOMRect[], dir: Dir): number {
  const cx = from.left + from.width / 2
  const cy = from.top + from.height / 2
  let best = -1
  let bestScore = Infinity
  cands.forEach((r, i) => {
    const horizontal = dir === 'left' || dir === 'right'
    // Edge-to-edge distance along the travel axis, so big and small targets compare fairly.
    const ahead =
      dir === 'left' ? from.left - r.right : dir === 'right' ? r.left - from.right : dir === 'up' ? from.top - r.bottom : r.top - from.bottom
    const centerAhead = dir === 'left' ? cx - (r.left + r.width / 2) : dir === 'right' ? r.left + r.width / 2 - cx : dir === 'up' ? cy - (r.top + r.height / 2) : r.top + r.height / 2 - cy
    if (centerAhead <= 1 || ahead < -Math.min(r.width, r.height) / 2) return
    // Overlap on the cross axis counts as perfectly in line.
    const off = horizontal ? Math.max(0, Math.max(r.top, from.top) - Math.min(r.bottom, from.bottom)) : Math.max(0, Math.max(r.left, from.left) - Math.min(r.right, from.right))
    const score = Math.max(0, ahead) + off * 3
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  })
  return best
}

const visible = (el: HTMLElement) => el.offsetParent !== null || el.getClientRects().length > 0

/** The topmost layer (an open overlay) traps focus. */
function scope(): ParentNode {
  const layers = document.querySelectorAll('[data-layer]')
  return layers.length ? layers[layers.length - 1] : document
}

export function focusables(root: ParentNode = scope()): HTMLElement[] {
  return (Array.prototype.slice.call(root.querySelectorAll('[data-f]')) as HTMLElement[]).filter(visible)
}

export function focusFirst(root: ParentNode = scope()) {
  const el = root.querySelector<HTMLElement>('[data-autofocus]') || focusables(root)[0]
  if (el) el.focus()
}

export function focusKey(key: string | null | undefined): boolean {
  if (!key) return false
  const el = scope().querySelector<HTMLElement>(`[data-key="${key.replace(/"/g, '')}"]`)
  if (!el) return false
  el.focus()
  return true
}

const lastInRow = new WeakMap<Element, HTMLElement>()

function reveal(el: HTMLElement) {
  const row = el.closest('[data-row]') as HTMLElement | null
  if (row) {
    lastInRow.set(row, el)
    const pad = 80
    const left = el.offsetLeft
    const right = left + el.offsetWidth
    if (right > row.scrollLeft + row.clientWidth - pad) row.scrollTo({ left: right - row.clientWidth + pad, behavior: 'smooth' })
    else if (left < row.scrollLeft + pad) row.scrollTo({ left: Math.max(0, left - pad), behavior: 'smooth' })
  }
  const page = el.closest('[data-scroll]') as HTMLElement | null
  if (page) {
    // Keep a row's heading in view with its cards; tall lists scroll by the focused row itself.
    const shelf = el.closest('.shelf') as HTMLElement | null
    const r = (shelf && shelf.offsetHeight < 620 ? shelf : el).getBoundingClientRect()
    const p = page.getBoundingClientRect()
    const top = r.top - p.top
    const margin = 180
    if (top < margin) page.scrollTo({ top: Math.max(0, page.scrollTop + top - margin), behavior: 'smooth' })
    else if (top + r.height > p.height - margin) page.scrollTo({ top: page.scrollTop + top + r.height - p.height + margin, behavior: 'smooth' })
  }
}

export function move(dir: Dir): boolean {
  const active = document.activeElement as HTMLElement | null
  const els = focusables()
  if (!active || els.indexOf(active) < 0) {
    focusFirst()
    return true
  }
  const others = els.filter((el) => el !== active)
  const i = pickNext(active.getBoundingClientRect(), others.map((el) => el.getBoundingClientRect()), dir)
  if (i < 0) return false
  let target = others[i]
  const fromRow = active.closest('[data-row]')
  const toRow = target.closest('[data-row]')
  if ((dir === 'up' || dir === 'down') && toRow && toRow !== fromRow) {
    const remembered = lastInRow.get(toRow)
    if (remembered && remembered.isConnected) target = remembered
  }
  target.focus()
  return true
}

export function installFocus(onBack: () => void, onKey: (e: KeyboardEvent) => boolean) {
  document.addEventListener('focusin', (e) => reveal(e.target as HTMLElement))
  document.addEventListener('keydown', (e) => {
    if (onKey(e)) return e.preventDefault()
    const active = document.activeElement as HTMLElement | null
    const typing = !!active && active.tagName === 'INPUT'
    // 10009 = Tizen Return key; Escape/Backspace for testing in a browser.
    if (e.keyCode === 10009 || e.keyCode === 27 || (e.keyCode === 8 && !typing)) {
      e.preventDefault()
      return onBack()
    }
    const dir = KEYS[e.keyCode]
    if (!dir) return
    if (typing && (dir === 'left' || dir === 'right')) return
    if (move(dir)) e.preventDefault()
  })
}
