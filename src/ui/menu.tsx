// The song's actions (BitChord TvSongActionsDialog): hold OK on any song, or More in Now Playing.
import { openDetail, openMenu } from '../nav'
import { addToQueue, playNext, playTracks } from '../player'
import type { Track } from '../sources/types'
import { isLiked, liked, toggleLike, useStore } from '../store'
import { Art, ListRow } from './kit'

export function SongMenu({ t }: { t: Track }) {
  useStore(liked)
  const fav = isLiked(t.id)
  const artist = (t.artists || []).filter((a) => a.id && /^UC/.test(a.id))[0]
  const done = (fn: () => void) => () => {
    openMenu(null)
    fn()
  }
  return (
    <div class="dialog-scrim" data-layer role="dialog" aria-modal="true" aria-label={`Actions for ${t.title}`}>
      <div class="dialog">
        <header class="dialog-head">
          <Art src={t.image} size={120} />
          <div>
            <b>{t.title}</b>
            <i>{t.artist}</i>
          </div>
        </header>
        <ListRow k="m-next" icon="playNext" title="Play Next" autofocus onClick={done(() => playNext(t))} />
        <ListRow k="m-queue" icon="addQueue" title="Add to Queue" onClick={done(() => addToQueue(t))} />
        <ListRow k="m-radio" icon="radio" title="Start Radio" subtitle="Plays this song, then similar ones" onClick={done(() => playTracks([t], 0))} />
        <ListRow k="m-fav" icon="star" title={fav ? 'Remove from Favourites' : 'Add to Favourites'} onClick={done(() => toggleLike(t))} />
        {t.albumId && t.source === 'ytm' ? <ListRow k="m-album" icon="album" title="Go to Album" subtitle={t.album} onClick={done(() => openDetail({ name: 'album', id: t.albumId! }))} /> : null}
        {artist ? <ListRow k="m-artist" icon="artist" title="Go to Artist" subtitle={artist.name} onClick={done(() => openDetail({ name: 'artist', id: artist.id! }))} /> : null}
      </div>
    </div>
  )
}
