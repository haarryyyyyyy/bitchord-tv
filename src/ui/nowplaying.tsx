import { useEffect, useRef, useState } from 'preact/hooks'
import { fetchLyrics, lineAt, type Lyrics } from '../lyrics'
import { openNowPlaying } from '../nav'
import { cycleRepeat, jumpTo, next, player, position, prev, toggle, toggleShuffle } from '../player'
import type { Stream, Track } from '../sources/types'
import { isLiked, liked, settings, toggleLike, useStore } from '../store'
import { Icon, PauseGlyph, PlayGlyph } from './icons'
import { LazyImg } from './lazyimg'
import { Ambient, Explicit, fmt, img, NowBars, useAsync } from './parts'

const sourceLabel = (s: Stream | null) => (s ? `${s.from === 'saavn' ? 'JioSaavn' : 'YouTube Music'} · ${s.codec}${s.kbps ? ' ' + s.kbps + ' kbps' : ''}` : '')

function Progress() {
  const p = useStore(position)
  const ratio = p.duration ? Math.min(1, p.time / p.duration) : 0
  return (
    <div class="progress">
      <button data-f data-key="np-seek" data-seek class="bar" aria-label="Seek. Left and right move 10 seconds">
        <span class="bar-fill" style={{ transform: `scaleX(${ratio})` }} />
        <span class="bar-knob" style={{ transform: `translateX(${ratio * 100}%)` }}>
          <i />
        </span>
      </button>
      <div class="times">
        <span>{fmt(p.time) || '0:00'}</span>
        <span>{p.duration ? '-' + fmt(Math.max(0, p.duration - p.time)) : ''}</span>
      </div>
    </div>
  )
}

function LyricsPanel({ t }: { t: Track }) {
  const l = useAsync<Lyrics | null>(() => fetchLyrics(t), [t.id])
  const p = useStore(position)
  const box = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const lyr = l.data
  const idx = lyr && lyr.synced ? lineAt(lyr.lines, p.time + 0.25) : -1

  useEffect(() => {
    if (!lyr || !box.current || !list.current) return
    const viewH = box.current.clientHeight
    if (lyr.synced) {
      const el = list.current.children[Math.max(0, idx)] as HTMLElement | undefined
      if (el) setOffset(Math.max(0, el.offsetTop - viewH * 0.32))
    } else {
      // Unsynced lyrics drift with the song so the words are roughly in view.
      const over = list.current.scrollHeight - viewH
      setOffset(over > 0 && p.duration ? (over * p.time) / p.duration : 0)
    }
  }, [idx, lyr, lyr && !lyr.synced ? Math.floor(p.time / 2) : 0])

  if (l.loading) return <p class="panel-note">Finding lyrics…</p>
  if (!lyr) return <p class="panel-note">No lyrics for this song.</p>
  return (
    <div class={'lyrics' + (lyr.synced ? ' synced' : ' plain')} ref={box}>
      <div class="lyrics-list" ref={list} style={{ transform: `translateY(${-offset}px)` }}>
        {lyr.lines.map((line, i) => (
          <p class={i === idx ? 'on' : i < idx ? 'past' : ''}>{line.text || '♪'}</p>
        ))}
      </div>
    </div>
  )
}

function QueuePanel() {
  const s = useStore(player)
  const upcoming = s.queue.slice(s.index + 1, s.index + 31)
  if (!upcoming.length) return <p class="panel-note">{settings.get().autoplay ? 'AutoPlay will add similar songs when this one ends.' : 'Nothing queued.'}</p>
  return (
    <div class="queue" data-scroll>
      {upcoming.map((t, i) => (
        <button data-f data-key={'q' + t.id} class="trow" onClick={() => jumpTo(s.index + 1 + i)}>
          <LazyImg class="trow-art" src={img(t.image, 120)} size={64} />
          <span class="trow-text">
            <b>{t.title}</b>
            <i>{t.artist}</i>
          </span>
          <span class="trow-time">{fmt(t.durationSec)}</span>
        </button>
      ))}
    </div>
  )
}

export function NowPlaying() {
  const s = useStore(player)
  const set = useStore(settings)
  useStore(liked)
  const t = s.queue[s.index]
  const [panel, setPanel] = useState<'lyrics' | 'queue'>(set.showLyrics ? 'lyrics' : 'queue')
  if (!t) return null
  const heart = isLiked(t.id)
  return (
    <div class="np" data-layer role="dialog" aria-label="Now Playing">
      <Ambient image={t.image} />
      <div class="np-player">
        <div class={'np-art' + (s.playing ? ' playing' : '')}>
          <img src={img(t.image, 800)} width="460" height="460" alt="" />
        </div>
        <div class="np-title">
          <div>
            <h1>
              {t.title}
              {t.explicit ? <Explicit /> : null}
            </h1>
            <p>{t.artist}</p>
          </div>
          <button data-f data-key="np-like" class={'iconbtn' + (heart ? ' on' : '')} aria-label={heart ? 'Unlike' : 'Like'} onClick={() => toggleLike(t)}>
            <Icon name="heart" size={34} fill={heart} />
          </button>
        </div>
        <p class="np-source">
          {s.loading ? <NowBars on /> : null}
          {s.error ? <span class="err">{s.error}</span> : sourceLabel(s.stream) || 'Loading…'}
        </p>
        <Progress />
        <div class="controls">
          <button data-f data-key="np-shuffle" class={'iconbtn' + (s.shuffle ? ' on' : '')} aria-label="Shuffle" onClick={toggleShuffle}>
            <Icon name="shuffle" size={34} />
          </button>
          <button data-f data-key="np-prev" class="iconbtn big" aria-label="Previous" onClick={prev}>
            <Icon name="prev" size={44} fill />
          </button>
          <button data-f data-autofocus data-key="np-play" class="playbtn" aria-label={s.playing ? 'Pause' : 'Play'} onClick={toggle}>
            {s.playing ? <PauseGlyph size={48} /> : <PlayGlyph size={48} />}
          </button>
          <button data-f data-key="np-next" class="iconbtn big" aria-label="Next" onClick={() => next()}>
            <Icon name="next" size={44} fill />
          </button>
          <button data-f data-key="np-repeat" class={'iconbtn' + (s.repeat !== 'off' ? ' on' : '')} aria-label={'Repeat ' + s.repeat} onClick={cycleRepeat}>
            <Icon name="repeat" size={34} />
            {s.repeat === 'one' ? <sup>1</sup> : null}
          </button>
        </div>
      </div>
      <section class="np-panel">
        <div class="tabs">
          <button data-f data-key="np-tab-lyrics" class={'tab' + (panel === 'lyrics' ? ' on' : '')} onClick={() => setPanel('lyrics')} onFocus={() => setPanel('lyrics')}>
            Lyrics
          </button>
          <button data-f data-key="np-tab-queue" class={'tab' + (panel === 'queue' ? ' on' : '')} onClick={() => setPanel('queue')} onFocus={() => setPanel('queue')}>
            Up Next
          </button>
          <button data-f data-key="np-close" class="tab ghost" onClick={() => openNowPlaying(false)}>
            <Icon name="back" size={26} /> Back
          </button>
        </div>
        {panel === 'lyrics' ? <LyricsPanel t={t} /> : <QueuePanel />}
      </section>
    </div>
  )
}

export function NowPill() {
  const s = useStore(player)
  const p = useStore(position)
  const t = s.queue[s.index]
  if (!t) return null
  return (
    <button data-f data-key="now-pill" class="pill-player" onClick={() => openNowPlaying(true)} aria-label={`Now Playing: ${t.title}. Press OK to open.`}>
      <img src={img(t.image, 120)} width="64" height="64" alt="" />
      <span class="pp-text">
        <b>{t.title}</b>
        <i>{t.artist}</i>
      </span>
      <span class="pp-state">{s.loading ? <NowBars on /> : s.playing ? <PauseGlyph size={30} /> : <PlayGlyph size={30} />}</span>
      <span class="pp-line" style={{ transform: `scaleX(${p.duration ? Math.min(1, p.time / p.duration) : 0})` }} />
    </button>
  )
}
