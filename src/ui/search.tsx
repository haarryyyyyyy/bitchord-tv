// Search with an on-screen keyboard (no TV IME): letters on the left, results that update
// as you type on the right. Suggestions and recent searches sit under the keyboard.
import { useEffect, useState } from 'preact/hooks'
import { cached } from '../lib/cache'
import { errText, log } from '../lib/log'
import * as saavn from '../sources/jiosaavn'
import type { Item, SearchResults, Track } from '../sources/types'
import * as ytm from '../sources/ytm'
import { addRecentSearch, recentSearches, useStore } from '../store'
import { Icon } from './icons'
import { Loading, Message, ShelfRow, ShelfTitle, SongGrid, useAsync } from './kit'

const ROWS = ['abcdef', 'ghijkl', 'mnopqr', 'stuvwx', 'yz1234', '567890']

async function searchAll(q: string): Promise<SearchResults> {
  const [yt, sv] = await Promise.all([
    ytm.search(q),
    saavn.search(q).catch((e) => {
      log.warn(`JioSaavn search failed: ${errText(e)}`)
      return [] as Track[]
    }),
  ])
  return { ...yt, saavn: sv }
}

const asItems = (tracks: Track[]): Item[] => tracks.map((t) => ({ kind: 'song', id: t.id, title: t.title, subtitle: t.artist, image: t.image, track: t }))

function Key({ ch, onPress }: { ch: string; onPress: (c: string) => void }) {
  return (
    <button data-f data-key={'key-' + ch} class="key" onClick={() => onPress(ch)} aria-label={ch.toUpperCase()}>
      {ch}
    </button>
  )
}

export function Search({ hidden }: { hidden?: boolean }) {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [sugg, setSugg] = useState<string[]>([])
  const recent = useStore(recentSearches)
  const res = useAsync(() => (query ? cached('q:' + query, () => searchAll(query), 5 * 60000) : Promise.resolve(null)), [query])

  // Results follow the typing after a short pause; suggestions sooner.
  useEffect(() => {
    const v = q.trim()
    const t1 = setTimeout(() => setQuery(v.length >= 2 ? v : ''), 600)
    let live = true
    const t2 = v.length >= 2 ? setTimeout(() => ytm.suggestions(v).then((s) => live && setSugg(s), () => live && setSugg([])), 250) : null
    if (v.length < 2) setSugg([])
    return () => {
      live = false
      clearTimeout(t1)
      if (t2) clearTimeout(t2)
    }
  }, [q])

  useEffect(() => {
    if (query && res.data) addRecentSearch(query)
  }, [res.data])

  const type = (c: string) => setQ((v) => (v + c).slice(0, 60))
  const pick = (text: string) => {
    setQ(text)
    setQuery(text)
  }
  const r = res.data
  const empty = r && !r.songs.length && !r.albums.length && !r.artists.length && !r.saavn.length
  const below = q.trim().length >= 2 ? sugg : recent

  return (
    <main class="page search" data-zone="page" style={hidden ? { display: 'none' } : undefined}>
      <aside class="search-side">
        <div class={'query' + (q ? '' : ' empty')} aria-live="polite">
          <Icon name="search" size={34} />
          <span>{q || 'Search songs, artists, albums'}</span>
          <i class="caret" aria-hidden="true" />
        </div>
        <div class="keyboard" role="group" aria-label="Keyboard">
          {ROWS.map((row) => (
            <div class="krow">
              {row.split('').map((ch) => (
                <Key ch={ch} onPress={type} />
              ))}
            </div>
          ))}
          <div class="krow">
            <button data-f data-key="key-space" class="key wide" onClick={() => type(' ')}>
              Space
            </button>
            <button data-f data-key="key-del" class="key" aria-label="Delete" onClick={() => setQ((v) => v.slice(0, -1))}>
              <Icon name="delete" size={30} />
            </button>
            <button data-f data-key="key-clear" class="key" onClick={() => setQ('')}>
              Clear
            </button>
          </div>
        </div>
        {below.length ? (
          <div class="suggest">
            <h3>{q.trim().length >= 2 ? 'Suggestions' : 'Recent Searches'}</h3>
            {below.slice(0, 5).map((s) => (
              <button data-f data-key={'sug-' + s} class="sug" onClick={() => pick(s)}>
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </aside>
      <div class="search-results">
        <div class="track" data-track>
          {!query ? <Message icon="search" title="Find music" text="Type with the keyboard. Results from YouTube Music and JioSaavn appear here as you type." /> : null}
          {query && res.loading && !r ? <Loading shelves={2} /> : null}
          {res.error ? <Message title="Search failed" text={`${res.error}. Check the TV's connection and try again.`} action="Try Again" onAction={res.retry} /> : null}
          {empty ? <Message icon="search" title={`No results for “${query}”`} text="Check the spelling, or try fewer words." /> : null}
          {r && !empty ? (
            <>
              {r.songs.length ? (
                <section class="shelf" data-sec>
                  <ShelfTitle title="Songs" />
                  <div class="pad">
                    <SongGrid tracks={r.songs.slice(0, 8)} cols={2} />
                  </div>
                </section>
              ) : null}
              {r.artists.length ? <ShelfRow shelf={{ title: 'Artists', items: r.artists }} /> : null}
              {r.albums.length ? <ShelfRow shelf={{ title: 'Albums', items: r.albums }} /> : null}
              {r.saavn.length ? <ShelfRow shelf={{ title: 'From JioSaavn', items: asItems(r.saavn) }} /> : null}
              {r.playlists.length ? <ShelfRow shelf={{ title: 'Playlists', items: r.playlists }} /> : null}
            </>
          ) : null}
        </div>
      </div>
    </main>
  )
}

