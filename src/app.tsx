import { useEffect, useRef, useState } from 'preact/hooks'
import { artColor } from './lib/artcolor'
import { ensureFocus, enter, installFocus, scrollPageTop } from './focus'
import { errText, log } from './lib/log'
import { back, nav, openNowPlaying, selectTab, useNav, type Detail, type Tab } from './nav'
import { next, pause, player, prev, seekBy, toggle } from './player'
import { settings, useStore } from './store'
import { Icon, LogoMark } from './ui/icons'
import { SongMenu } from './ui/menu'
import { NowPlaying, nowPlayingKeys } from './ui/nowplaying'
import { Artist, Collection, Explore, Home, Library, MoodPage, SettingsPage } from './ui/pages'
import { Search } from './ui/search'

/** BitChord TV's canvas: a soft vertical gradient with the playing artwork's colour washed across the top. */
function Canvas() {
  const s = useStore(player)
  const theme = useStore(settings).theme
  const t = s.queue[s.index]
  const [layers, setLayers] = useState<{ a: string; b: string; top: 'a' | 'b' }>({ a: '', b: '', top: 'a' })
  useEffect(() => {
    if (!t || theme === 'oled') return
    let live = true
    artColor(t.image).then(
      ([r, g, b]) => live && setLayers((l) => {
        const c = `${r}, ${g}, ${b}`
        return l.top === 'a' ? { ...l, b: c, top: 'b' } : { ...l, a: c, top: 'a' }
      }),
      () => {},
    )
    return () => {
      live = false
    }
  }, [t && t.image, theme])
  return (
    <div class="canvas" aria-hidden="true">
      {(['a', 'b'] as const).map((k) =>
        layers[k] ? <div class={'tint' + (layers.top === k && theme !== 'oled' ? ' on' : '')} style={{ background: `radial-gradient(ellipse 75% 70% at 50% -12%, rgba(${layers[k]}, 0.55), rgba(${layers[k]}, 0) 100%)` }} /> : null,
      )}
    </div>
  )
}

const TABS: { tab: Tab; label: string }[] = [
  { tab: 'home', label: 'Home' },
  { tab: 'explore', label: 'Explore' },
  { tab: 'library', label: 'Library' },
]

/** The tvOS tab bar: a capsule at the top. Home, Explore and Library switch as focus lands on them. */
function TopBar({ tab }: { tab: Tab }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const switchSoon = (t: Tab) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => selectTab(t), 140)
  }
  const pill = (t: Tab, label: string) => (
    <button data-f data-key={'tab-' + t} data-selected={tab === t ? '' : undefined} class={'tab' + (tab === t ? ' selected' : '')} onFocus={() => switchSoon(t)} onBlur={() => timer.current && clearTimeout(timer.current)} onClick={() => selectTab(t)}>
      {label}
    </button>
  )
  return (
    <header class="bar" data-zone="bar">
      <span class="bar-logo">
        <LogoMark height={34} />
      </span>
      <nav class="tabs" aria-label="Sections">
        {TABS.map((x) => pill(x.tab, x.label))}
        <button data-f data-key="tab-now" class="tab" onClick={() => openNowPlaying(true)}>
          Now Playing
        </button>
        {(['search', 'settings'] as Tab[]).map((t) => (
          <button data-f data-key={'tab-' + t} data-selected={tab === t ? '' : undefined} class={'tab icon' + (tab === t ? ' selected' : '')} aria-label={t === 'search' ? 'Search' : 'Settings'} onClick={() => selectTab(t)}>
            <Icon name={t} size={30} stroke={2.4} />
          </button>
        ))}
      </nav>
    </header>
  )
}

function TabPage({ tab, hidden }: { tab: Tab; hidden: boolean }) {
  switch (tab) {
    case 'home':
      return <Home hidden={hidden} />
    case 'explore':
      return <Explore hidden={hidden} />
    case 'library':
      return <Library hidden={hidden} />
    case 'search':
      return <Search hidden={hidden} />
    case 'settings':
      return <SettingsPage hidden={hidden} />
  }
}

function DetailPage({ d, hidden }: { d: Detail; hidden: boolean }) {
  if (d.name === 'artist') return <Artist id={d.id} hidden={hidden} />
  if (d.name === 'mood') return <MoodPage id={d.id} params={d.params} title={d.title} hidden={hidden} />
  return <Collection id={d.id} hidden={hidden} />
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
    const on = (e: Event) => {
      setMsg((e as CustomEvent).detail)
      setTimeout(() => setMsg(null), 2000)
    }
    window.addEventListener('bc-toast', on)
    return () => window.removeEventListener('bc-toast', on)
  }, [])
  return (
    <div class="toast-region" role="status" aria-live="polite">
      {msg ? <div class="toast">{msg}</div> : null}
    </div>
  )
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
  window.dispatchEvent(new CustomEvent('bc-toast', { detail: 'Press Back again to exit BitChord' }))
}

function onBack() {
  const active = document.activeElement
  const inBar = !!active && !!active.closest('[data-zone=bar]')
  const r = back(inBar)
  if (r === 'to-bar') {
    const page = document.querySelector<HTMLElement>('[data-zone=page]:not([style*="none"])')
    scrollPageTop(page)
    const tab = document.querySelector<HTMLElement>('[data-zone=bar] [data-selected]')
    if (tab) tab.focus()
  } else if (r === 'exit') exitApp()
}

const MEDIA_KEYS = ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind', 'MediaTrackNext', 'MediaTrackPrevious']

function onKey(e: KeyboardEvent): boolean {
  const n = nav.get()
  if (n.nowPlaying && !n.menu && nowPlayingKeys && nowPlayingKeys(e)) return true
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

/** After a screen change, focus lands once the new content exists. */
function settle(fresh: boolean) {
  let tries = 0
  const tick = () => {
    const layer = document.querySelector<HTMLElement>('[data-layer]')
    const pages = document.querySelectorAll<HTMLElement>('[data-zone=page]')
    const page = pages.length ? pages[pages.length - 1] : null
    const target = layer || (fresh ? page : null)
    if (target) {
      if (target.contains(document.activeElement) || enter(target)) return
    } else {
      ensureFocus()
      if (document.activeElement && document.activeElement !== document.body) return
    }
    if (++tries < 30) setTimeout(tick, 100)
  }
  setTimeout(tick, 20)
}

export function App() {
  const n = useNav()
  const theme = useStore(settings).theme
  const depth = useRef(n.stack.length)
  useEffect(() => {
    installFocus(onBack, onKey)
    try {
      const input = (window as any).tizen && (window as any).tizen.tvinputdevice
      if (input) MEDIA_KEYS.forEach((k) => input.registerKey(k))
    } catch (e) {
      log.warn('Media keys not registered: ' + errText(e))
    }
    window.addEventListener('error', (e) => log.error(`Script error: ${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`))
    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => log.error('Unhandled: ' + errText(e.reason)))
    log.info('BitChord TV started')
    // The app opens on the tab bar, as BitChord TV does.
    setTimeout(() => {
      const tab = document.querySelector<HTMLElement>('[data-zone=bar] [data-selected]')
      if (tab) tab.focus()
    }, 60)
  }, [])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  useEffect(() => {
    const pushed = n.stack.length > depth.current
    depth.current = n.stack.length
    settle(pushed)
  }, [n.stack.length, n.nowPlaying, n.menu])
  // The bar's hidden state belongs to the page on screen, not the one before it.
  useEffect(() => {
    const pages = document.querySelectorAll<HTMLElement>('[data-zone=page]')
    const track = pages.length ? pages[pages.length - 1].querySelector<HTMLElement>('[data-track]') : null
    const y = track ? parseFloat(track.style.getPropertyValue('--y') || '0') : 0
    document.documentElement.classList.toggle('scrolled', y < 0)
  }, [n.stack.length, n.tab])
  const top = n.stack.length - 1
  return (
    <div class={'app' + (n.nowPlaying ? ' covered' : '')}>
      <Canvas />
      <div class="shell" aria-hidden={n.nowPlaying}>
        <TabPage key={n.tab} tab={n.tab} hidden={top >= 0} />
        {n.stack.map((d, i) => (
          <DetailPage key={i + ':' + d.name + d.id + ('params' in d ? d.params : '')} d={d} hidden={i !== top} />
        ))}
        <TopBar tab={n.tab} />
      </div>
      {n.nowPlaying ? <NowPlaying /> : null}
      {n.menu ? <SongMenu t={n.menu} /> : null}
      <Toast />
    </div>
  )
}
