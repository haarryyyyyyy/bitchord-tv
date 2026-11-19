# Task List: BitChord for Tizen TV (v2)

Plan: `tasks/plan.md`. Dependency order. Each task leaves the app working. Base: fork of `kushagrasinghx/BitChord` `web/app`. Commands are placeholders until Task 1 fixes the toolchain (pnpm, Vite, Vitest, Tizen CLI).

## Phase 0: De-risk

- [x] **Task 0: Inspect BitChord repo** (done)
  - Result: `web/app` is the reusable base; `tv/` is native Android only; `backend/` is party server only; design tokens in `web/docs/apple-music-dom.md`; playback path in `web/docs/youtube-playback.md`.

- [x] **Task 1 (built, needs TV run): Tizen shell + JioSaavn source** (M) — code in `bitchord-tv/`: Preact + Vite, `config.xml`, D-pad focus, Info screen (UA, model), JioSaavn search and playback, 9 unit tests pass, live API test passes, builds to a 49KB (19KB gz) IIFE bundle. Still to verify ON THE TV: cross-origin calls allowed, AAC plays, focus feel. Original task text kept below.
- [ ] (original) **Task 1: Fork + Tizen shell** (M)
  - Acceptance: fork builds with extension bridge stubbed out; `config.xml` added; app launches on the real TV via Developer Mode; on-screen text shows `navigator.userAgent`, Tizen version, resolution; arrow keys move focus across a test grid; Back exits.
  - Verify: `pnpm build` ok; `tizen package -t wgt` ok; install with `sdb`/`tizen install`; photo or log of UA and focus test; record Chromium version in `docs/findings.md` and set Vite `build.target`.
  - Depends: T0. Files: `config.xml`, `vite.config.ts`, `src/main.tsx`, `docs/findings.md`.

- [ ] **Task 2: SPIKE one track plays on the TV** (M)
  - Acceptance: Option A first: YouTube.js inside the TV app (VISIONOS client, `<access origin="*">`, no Origin/Referer) resolves a known video ID and `<audio>` plays it, pause/resume works. If A fails (CORS, bundling, TLS or headers), Option B: Node + YouTube.js on the Windows PC returns the URL (or proxies bytes). Record: which option works, Opus plays or not, URL works from the TV, stream lasts a full track (over 3 min). If Opus fails, serve AAC (ffmpeg on the PC, so B becomes required).
  - Verify: backend test returns URL + itag; manual full-track play on the TV; findings logged.
  - Depends: T1. Files: `backend/src/resolve.ts`, `backend/src/stream.ts`, `src/player/audio.ts`, `backend/test/resolve.test.ts`.

### Checkpoint: Feasibility
- [ ] Real audio on the real TV. Codec path and backend host chosen. Human review before Phase 1.

## Phase 1: Core listening loop

- [ ] **Task 3: TV design system + focus engine** (M)
  - Acceptance: BitChord tokens (dark `#1f1f1f`, accent `#fa586a`, glass, DM Sans) scaled for 1080p; left icon rail; bottom now-playing bar; spatial D-pad focus with remembered position per screen; focus = scale + ring on `transform`.
  - Verify: `pnpm test` (focus move/wrap/memory); screenshot review; 60fps check on the TV.
  - Depends: T1. Files: `src/tv/focus/*`, `src/tv/theme.css`, `src/tv/Rail.tsx`, `src/tv/PlayerBar.tsx`.

- [ ] **Task 4: Search to play** (M)
  - Acceptance: remote-friendly on-screen keyboard; results grouped songs/albums/artists; Enter plays a song; loading + error states; debounced; backend `/search` endpoint.
  - Verify: `pnpm test` (search state, debounce, parser fixtures from repo); manual search and play on TV.
  - Depends: T2, T3. Files: `src/tv/screens/Search.tsx`, `backend/src/search.ts`, `src/api/client.ts`.

- [ ] **Task 5: Now Playing + queue** (M)
  - Acceptance: full-screen now playing (art, title, seek, play/pause/next/prev, shuffle/repeat); artwork-driven accent (cached per track); queue panel; remote media keys; auto-advance; pauses when app goes to background.
  - Verify: `pnpm test` (queue state machine); full album play on TV.
  - Depends: T4. Files: `src/tv/screens/NowPlaying.tsx`, `src/player/queue.ts`.

### Checkpoint: Core loop
- [ ] Remote-only: search, play, queue, skip. Measure start time, bundle size, heap after 30 min. Human review.

## Phase 2: BitChord feel

- [ ] **Task 6: Home + album/artist pages** (M)
  - Acceptance: home shelves (virtualized, focus memory); album and artist pages with play/shuffle; lazy images at TV sizes; backend `/browse` endpoints.
  - Verify: tests for shelf focus memory; manual browse; memory stays flat while scrolling.
  - Depends: T5. Files: `src/tv/screens/{Home,Album,Artist}.tsx`, `backend/src/browse.ts`.

- [ ] **Task 7: Synced lyrics** (M)
  - Acceptance: lyrics fetched (LRCLIB, per `web/docs/lyrics.md`) and cached; large current line, faded others, smooth scroll on `transform`; "no lyrics" state.
  - Verify: `pnpm test` (LRC parser, line lookup); manual on 3 tracks.
  - Depends: T5. Files: `src/tv/screens/Lyrics.tsx`, `src/lyrics/*`, `backend/src/lyrics.ts`.

- [ ] **Task 8: Listening history + recommendations** (M)
  - Acceptance: every play logged locally (track, artist, % completed, timestamp); "For you" shelf on Home built from top recent tracks via YouTube Music radio/next, ranked by completion + recency, no repeats from today; works with zero history (falls back to trending); "Clear history" in settings.
  - Verify: `pnpm test` (scoring and dedupe on fixture history); manual: play 5 tracks of one genre, check shelf shifts toward it.
  - Depends: T5, T6. Files: `src/history/*`, `src/tv/screens/Home.tsx`, `backend/src/recommend.ts`, tests.

- [ ] **Task 9: Gapless + settings** (S)
  - Acceptance: next track preloaded for gapless where the codec allows; settings: theme, audio quality, sleep timer, stats-for-nerds (codec, bitrate).
  - Verify: tests for sleep timer; manual gapless listen.
  - Depends: T5. Files: `src/player/gapless.ts`, `src/tv/screens/Settings.tsx`.

### Checkpoint: Core design parity
- [ ] Human reviews the TV UI against the BitChord look. Sign-off.

## Phase 3: Ship

- [ ] **Task 10: Performance pass on the TV** (M)
  - Acceptance: cold start under 3s, bundle under 300KB gz, heap under 150MB after 30 min of playback, 60fps focus/scroll, input latency under 100ms.
  - Verify: Tizen profiler + 30-minute soak; log in `docs/perf.md`.
  - Depends: T6-T9.

- [ ] **Task 11: Sideload package + guide** (S)
  - Acceptance: signed `.wgt`; one-page guide: enable Developer Mode, set host IP, install, set backend address; backend start script and README; GPLv3 notices kept.
  - Verify: fresh install on the TV from the guide only.
  - Depends: T10.

### Checkpoint: Complete
- [ ] Budget met, fresh-install works, human review done.
