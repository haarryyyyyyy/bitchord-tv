// What is on screen: the tab, the pages pushed over it, Now Playing and the song menu.
// Tab pages stay mounted under pushed pages (hidden), so Back returns to the same card.
import type { Track } from './sources/types'
import { createStore, useStore } from './store'

export type Tab = 'home' | 'explore' | 'library' | 'search' | 'settings'

export type Detail =
  | { name: 'album'; id: string }
  | { name: 'artist'; id: string }
  | { name: 'mood'; id: string; params: string; title: string }

export interface NavState {
  tab: Tab
  stack: Detail[]
  nowPlaying: boolean
  /** The song whose action menu is open. */
  menu: Track | null
}

export const nav = createStore<NavState>({ tab: 'home', stack: [], nowPlaying: false, menu: null })
export const useNav = () => useStore(nav)

export const selectTab = (tab: Tab) => nav.set((n) => (n.tab === tab && !n.stack.length ? n : { ...n, tab, stack: [] }))
export const openDetail = (d: Detail) => nav.set((n) => ({ ...n, stack: n.stack.concat([d]), nowPlaying: false, menu: null }))
export const openNowPlaying = (open = true) => nav.set((n) => ({ ...n, nowPlaying: open, menu: null }))
export const openMenu = (t: Track | null) => nav.set((n) => ({ ...n, menu: t }))

/**
 * Back, as BitChord TV does it: close the menu, pop a pushed page, else go up to the
 * tab bar, else from the bar back to Home. Returns false when the app should exit.
 * Now Playing handles its own Back first (Up Next, then the transport, then close).
 */
export function back(focusInBar: boolean): 'handled' | 'to-bar' | 'exit' {
  const n = nav.get()
  if (n.menu) return nav.set({ ...n, menu: null }), 'handled'
  if (n.nowPlaying) return nav.set({ ...n, nowPlaying: false }), 'handled'
  if (n.stack.length) return nav.set({ ...n, stack: n.stack.slice(0, -1) }), 'handled'
  if (!focusInBar) return 'to-bar'
  if (n.tab !== 'home') return nav.set({ ...n, tab: 'home' }), 'handled'
  return 'exit'
}
