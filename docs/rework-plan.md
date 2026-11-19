# Rework plan (v0.2): fix TV performance, navigation and design

Feedback from the first install on a real TV:
1. Extremely laggy.
2. Can't move between the side rail and screens.
3. Hard to reach Now Playing (focus jumps into albums).
4. Needs an in-app keyboard.
5. Lyrics from the wrong song.
6. Ugly, and not like BitChord.
7. Icon shows squashed text.

## Root causes (from the v0.1 code)
| Symptom | Cause | Fix |
|---|---|---|
| Lag | `filter: blur(48px)` on a 2300×1300 artwork layer inside the scrolling page, plus `backdrop-filter`, big blurred focus shadows with transitions, and smooth `scrollTo` on overflow containers (main-thread repaint every frame) | No filters at all. Ambient colour = an 8×8 canvas stretched by the GPU (free bilinear blur). Rows and pages move by `transform` on one composited track. Focus shadow is a pre-drawn pseudo-element whose opacity fades. |
| Lag | Every track row subscribed to the player store; position ticks re-rendered the pill | The current track is read once per list; the scrubber and times write to the DOM directly |
| Rail unreachable | Geometric search across the whole document; rail labels resized the rail on focus | BitChord TV's model: a fixed top tab bar. Up from a page's top row goes to the bar, Down from the bar returns to the page's last focus. Navigation is scoped per zone. |
| Now Playing hard to reach | The floating pill sat among cards | A "Now Playing" tab in the bar, as in BitChord TV (`TvApp.kt` TvTopBar) |
| Keyboard | Relied on the TV's IME | An on-screen keyboard grid in Search, live results as you type |
| Wrong lyrics | LRCLIB search fallback took the first row whatever its title; duration was often 0 | Accept an LRCLIB row only when BitChord's TrackMatcher says it is the same recording, and use the real audio duration |
| Icon | `Logo.png` is mark + white text | Crop to the mark only (done) |

## Design source of truth
BitChord's own TV module (`tv/src/main/java/.../ui/tv`, Compose for TV). It is Apple Music on tvOS. Its dp values are doubled for the 1920×1080 web canvas.
- **Canvas:** `#26272C` → `#101012`, with a radial wash of the playing artwork's colour at the top (`TvApp.kt` tvCanvas).
- **Focus:** the focused element lifts (scale 1.08, soft shadow) and is never outlined. Controls invert to a white platter with `#0C0C0E` text (`TvKit.kt` tvLift, tvPlatter).
- **Type** (`TvType`): LargeTitle 58, Title 44, Headline 32, Body 28, Callout 26, CardTitle 24, Caption 22, Tab 26.
- **Spacing:** safe margins 76×44, cards 32 apart, shelves 48 apart, content starts 138 from the top.
- **Tab bar:** a centred capsule (white 8%) holding Home, Explore, Library, Now Playing, Search and Settings, with the logo mark on the left. It hides as the page scrolls.
- **Now Playing** (`TvNowPlayingScreen.kt`):
  - The artwork mesh fills the screen, under a 22% black scrim.
  - The cover sits centred, and glides left when lyrics appear.
  - The transport (title, buttons, scrubber) rises on any key press and hides after 5 s idle.
  - Down from the scrubber opens Up Next.
  - With the transport hidden, Left and Right change tracks.
- **Features kept:** Home, Explore (new releases, moods & genres, trending), Library, Search, artist/album/playlist pages, Now Playing with lyrics and Up Next, the song action menu, three themes (Dynamic, OLED black, Midnight), JioSaavn swap, AutoPlay, sleep timer, history recommendations.
- **Features dropped:** sign-in, Listen Together, downloads, addons, spatial audio, refresh-rate switching.

## Tasks
1. Navigation core: zones, bar/page handoff, rows with memory, transform scrolling, long-press OK. Tests for pickNext and row logic.
2. Visual system: tokens from TvTheme/TvGlass, canvas tint, lift and platter components, motion tokens, reduced motion.
3. Shell: top bar with Now Playing tab, page stack that keeps tab pages alive under detail pages.
4. Screens: Home, Explore (+ mood pages), Library, Search with keyboard, Album/Playlist, Artist, Settings with themes.
5. Now Playing: stage, transport, scrubber, Up Next, flash glyph, auto-hide.
6. Lyrics matching fix + tests.
7. Verify: unit tests, build, preview walk-through at 1920×1080, then publish v0.2.0.
