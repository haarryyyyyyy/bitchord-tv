// Screen stack. Back pops; the focused element's key is saved so returning restores focus.
import { createStore, useStore } from './store'

export type Route =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'library' }
  | { name: 'settings' }
  | { name: 'album'; id: string }
  | { name: 'artist'; id: string }

export interface Entry {
  route: Route
  focus?: string
}

export const nav = createStore<{ stack: Entry[]; nowPlaying: boolean }>({ stack: [{ route: { name: 'home' } }], nowPlaying: false })

const activeKey = () => (document.activeElement && (document.activeElement as HTMLElement).dataset && (document.activeElement as HTMLElement).dataset.key) || undefined

export function go(route: Route) {
  nav.set((n) => {
    const stack = n.stack.slice()
    stack[stack.length - 1] = { ...stack[stack.length - 1], focus: activeKey() }
    return { stack: stack.concat([{ route }]), nowPlaying: false }
  })
}

/** Rail sections replace the stack instead of growing it. */
export function goRoot(route: Route) {
  nav.set({ stack: [{ route }], nowPlaying: false })
}

/** Returns false when there is nothing to go back to. */
export function back(): boolean {
  const n = nav.get()
  if (n.nowPlaying) {
    nav.set({ ...n, nowPlaying: false })
    return true
  }
  if (n.stack.length > 1) {
    nav.set({ ...n, stack: n.stack.slice(0, -1) })
    return true
  }
  if (n.stack[0].route.name !== 'home') {
    goRoot({ name: 'home' })
    return true
  }
  return false
}

export const openNowPlaying = (open = true) => nav.set((n) => ({ ...n, nowPlaying: open }))

export const useNav = () => useStore(nav)
