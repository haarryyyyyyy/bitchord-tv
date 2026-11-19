import { useEffect, useState } from 'preact/hooks'
import { focusFirst, focusKey, installFocus } from './focus'
import { errText, log } from './lib/log'
import { back, goRoot, nav, openNowPlaying, useNav, type Route } from './nav'
import { next, pause, player, prev, seekBy, toggle } from './player'
import { useStore } from './store'
import { Icon, Logo } from './ui/icons'
import { NowPill, NowPlaying } from './ui/nowplaying'
import { Artist, Collection, Home, Library, Search, SettingsScreen } from './ui/screens'

const RAIL: { route: Route; icon: string; label: string }[] = [
  { route: { name: 'home' }, icon: 'home', label: 'Listen Now' },
  { route: { name: 'search' }, icon: 'search', label: 'Search' },
  { route: { name: 'library' }, icon: 'library', label: 'Library' },
  { route: { name: 'settings' }, icon: 'settings', label: 'Settings' },
]

function Rail({ at }: { at: string }) {
  return (
    <nav class="rail" aria-label="Sections">
      <div class="rail-logo">
        <Logo size={56} />
        <span>BitChord</span>
      </div>
      {RAIL.map((r) => (
        <button data-f data-key={'rail-' + r.route.name} class={'rail-item' + (at === r.route.name ? ' on' : '')} onClick={() => goRoot(r.route)}>
          <Icon name={r.icon} size={34} />
          <span>{r.label}</span>
        </button>
      ))}
    </nav>
  )
}

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <Home />
    case 'search':
      return <Search />
    case 'library':
      return <Library />
    case 'settings':
      return <SettingsScreen />
    case 'album':
      return <Collection id={route.id} />
    case 'artist':
      return <Artist id={route.id} />
  }
}

function Toast() {
  const s = useStore(player)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!s.error) return
    setMsg(s.error)
    const t = setTimeout(() => setMsg(null), 5000)
    return () => clearTimeout(t)
  }, [s.error])
  useEffect(() => {
    const onExitHint = (e: Event) => {
      setMsg((e as CustomEvent).detail)
      setTimeout(() => setMsg(null), 2000)
    }
    window.addEventListener('bc-toast', onExitHint)
    return () => window.removeEventListener('bc-toast', onExitHint)
  }, [])
  return msg ? (
    <div class="toast" role="status">
      {msg}
    </div>
  ) : null
}

/** After a screen change, put focus on the remembered element, or the first one once content arrives. */
function settleFocus(key: string | undefined) {
  let tries = 0
  const tick = () => {
    if (key && focusKey(key)) return
    const active = document.activeElement
    const inLayer = active && active !== document.body && document.body.contains(active) && active.closest('.page, [data-layer]')
    if (!inLayer) {
      const page = document.querySelector('[data-layer]') || document.querySelector('.page')
      if (page && page.querySelector('[data-f]')) return focusFirst(page)
    }
    if (++tries < 40) setTimeout(tick, 100)
  }
  setTimeout(tick, 30)
}

let exitArmed = 0

function exitApp() {
  if (Date.now() - exitArmed < 2000) {
    try {
      ;(window as any).tizen.application.getCurrentApplication().exit()
    } catch {
      log.warn('Exit is only available on the TV')
    }
    return
  }
  exitArmed = Date.now()
  window.dispatchEvent(new CustomEvent('bc-toast', { detail: 'Press Back again to exit' }))
}

const MEDIA_KEYS = ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind', 'MediaTrackNext', 'MediaTrackPrevious']

function onKey(e: KeyboardEvent): boolean {
  const active = document.activeElement as HTMLElement | null
  if (active && active.dataset.seek !== undefined && (e.keyCode === 37 || e.keyCode === 39)) {
    seekBy(e.keyCode === 39 ? 10 : -10)
    return true
  }
  switch (e.keyCode) {
    case 10252: // MediaPlayPause
    case 415: // MediaPlay
      toggle()
      return true
    case 19: // MediaPause
    case 413: // MediaStop
      pause()
      return true
    case 417: // MediaFastForward
      seekBy(10)
      return true
    case 412: // MediaRewind
      seekBy(-10)
      return true
    case 10233: // MediaTrackNext
      next()
      return true
    case 10232: // MediaTrackPrevious
      prev()
      return true
  }
  return false
}

export function App() {
  const n = useNav()
  const top = n.stack[n.stack.length - 1]
  useEffect(() => {
    installFocus(() => back() || exitApp(), onKey)
    try {
      const input = (window as any).tizen && (window as any).tizen.tvinputdevice
      if (input) MEDIA_KEYS.forEach((k) => input.registerKey(k))
    } catch (e) {
      log.warn('Media keys not registered: ' + errText(e))
    }
    window.addEventListener('error', (e) => log.error(`Script error: ${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`))
    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => log.error('Unhandled: ' + errText(e.reason)))
    log.info('BitChord TV started')
  }, [])
  useEffect(() => settleFocus(n.nowPlaying ? undefined : top.focus), [n.stack.length, top.route, n.nowPlaying])
  return (
    <div class="app">
      <Rail at={n.stack[0].route.name} />
      <Screen key={JSON.stringify(top.route)} route={top.route} />
      {!n.nowPlaying ? <NowPill /> : null}
      {n.nowPlaying ? <NowPlaying /> : null}
      <Toast />
    </div>
  )
}
