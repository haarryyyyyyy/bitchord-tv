export type SourceId = 'saavn' | 'ytm'

export interface Ref {
  name: string
  id?: string
}

export interface Track {
  source: SourceId
  id: string
  title: string
  /** Credited artists as one line ("A, B & C"). */
  artist: string
  artists?: Ref[]
  album?: string
  albumId?: string
  image: string
  durationSec: number
  explicit: boolean
  /** A music video rather than the catalogue song (YouTube only). */
  isVideo?: boolean
}

export interface Stream {
  url: string
  kbps: number | null
  /** What the player shows: "AAC", "Opus". */
  codec: string
  /** Which catalogue actually serves the audio (may differ from the track's own source). */
  from: SourceId
}

export type ItemKind = 'song' | 'video' | 'album' | 'single' | 'artist' | 'playlist'

/** Anything a card or row can show. Songs carry their track. */
export interface Item {
  kind: ItemKind
  id: string
  title: string
  subtitle: string
  image: string
  track?: Track
}

export interface Shelf {
  title: string
  items: Item[]
  /** Optional link for "see more" style headers, unused for now. */
  id?: string
}

export interface Collection {
  kind: 'album' | 'playlist'
  id: string
  title: string
  subtitle: string
  artist: string
  artistId?: string
  image: string
  description?: string
  tracks: Track[]
}

export interface ArtistPage {
  id: string
  name: string
  image: string
  description?: string
  topSongs: Track[]
  shelves: Shelf[]
}

export interface SearchResults {
  songs: Track[]
  albums: Item[]
  artists: Item[]
  playlists: Item[]
  saavn: Track[]
}
