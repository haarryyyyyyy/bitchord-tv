# Implementation Plan: BitChord for Samsung Tizen TV (v2, after repo inspection)

## Overview
Fork the open-source BitChord repo (GPLv3) and ship a Tizen TV web app (`.wgt`), sideloaded through Developer Mode onto a 2023 Samsung TV (Tizen 6.5). Keep BitChord's core design language (Apple Music-inspired, dark glass, artwork-driven accent, big synced lyrics, DM Sans). Adapt layout for a 10-foot, remote-only screen. Recommendations come from the user's own listening history.

Decisions from the user: fork is allowed, sideload only, Tizen 6.5 target, real TV available, no accounts/library/sign-in needed, history-based recommendations wanted, UI may differ for TV but core design stays.

## What the repo inspection found (verified from GitHub files)
- **`web/app` is the best base.** Vite + React 19 + TypeScript + React Router + TanStack Query + Zustand + Tailwind v4. A web player already exists, with parser fixtures and design notes in `web/docs/`.
- **`tv/` is native Android TV (Compose), not reusable** for Tizen. Use it only as a feature reference (home, search, now-playing, lyrics).
- **`backend/` is a Go "Listen Together" party server.** It does no stream resolving, lyrics or recommendations. Out of scope for v1 (dropped).
- **Design tokens are documented** in `web/docs/apple-music-dom.md`: page `#1f1f1f`, text `#ffffffeb/a3/66`, accent `#fa586a` / `#fa233b`, glass `#26262899` with `blur(16px) saturate(2.2)`, DM Sans, 34/26/17/15/13/12px type scale, lyrics 28 to 72px, 300px side panels, 668x56 pill player, radii 5-14px and 1000px pills. These become the TV theme (scaled up for TV).
- **The real hard problem is playback.** The web app needs a browser extension because YouTube blocks CORS and needs Origin/Referer headers. A TV has no extension. Working path in their docs: VISIONOS client gives direct Opus (itag 251) URLs with no PO token; URLs need signature + `n` deciphering (done by YouTube.js). The web-client (PO token) path is documented as still broken (~60-70s cutoffs). Plan uses only the VISIONOS-style path.

## Sources (verified in `app/.../data/sources/` and `jiosaavn/JioSaavnService.kt`)
- BitChord has 5 source kinds, ranked: user addons, custom module, JioSaavn, YouTube Music. For the TV: **JioSaavn + YouTube Music only.** Addons/modules/lossless dropped. Listen Together dropped.
- **JioSaavn** is easy: one endpoint `https://www.jiosaavn.com/api.php` (`search.getResults`, `song.getDetails`), DES-ECB decrypt of `encrypted_media_url` (key `38346591`), rewrite `_96` to `_320` when `320kbps=true`. Result is plain AAC/MP4, which Tizen plays natively. **Ported and verified live** (320 kbps URL, HTTP 200). No signature deciphering, no PO tokens.
- **YouTube Music** is the hard source (see decisions below). It gives the full catalogue, radio and recommendations.
- BitChord also matches a track across sources (title, artist, duration within ~2s) to substitute JioSaavn's 320 AAC for a YouTube track. Deferred: Task 6b, port `TrackMatcher` rules after both sources work.
- Because JioSaavn works first, playback is de-risked: the app is usable even if YouTube Music on-device fails.

## Architecture Decisions
1. **Fork `web/app`, strip the extension bridge.** Keep UI components, stores, parsers. Replace the "page to extension" bridge with a small HTTP client to our backend.
2. **No-backend first, backend only if the spike needs it.** BitChord's own `backend/` cannot be used: it is only the Go "Listen Together" party server and does no stream resolving (its README says each device resolves its own streams). So Task 2 tests two options on the real TV: (A) run YouTube.js on the TV itself with the VISIONOS client, using Tizen's `<access origin="*">` rule in `config.xml` to allow cross-origin calls and sending no Origin/Referer (the VISIONOS path in the repo docs sends neither); (B) fallback: small Node + YouTube.js backend on the user's PC (their answer: PC is fine). A wins if it works: no PC needed, simplest to run. **Update: user has no server, so on-device (A) is the primary and only planned path.** Use a lean custom InnerTube client (search, player, next) instead of full YouTube.js, and decipher the `sig`/`n` params on the TV by extracting the functions from YouTube's player JS and running them with `new Function` (assumed workable, spike verifies). B (PC helper) is only a last resort and needs the user's approval. Cloud hosting is rejected: YouTube often blocks datacenter IPs and stream URLs are IP-bound, so audio would have to be proxied (bandwidth cost).
3. **Run the backend on the same LAN/public IP as the TV.** googlevideo URLs are usually bound to the requesting IP (assumed; spike verifies). If it fails, backend proxies the audio bytes (`/stream`).
4. **Playback via native `<audio>`, not Shaka.** Shaka is large and the direct URL is plain progressive audio. Opus/WebM on Tizen 6.5 is NOT guaranteed. Spike decides: direct Opus, else backend remux/transcode to AAC (ffmpeg).
5. **Compatibility floor: Tizen 5.5 (2020) and newer; older is best effort.** Model unknown, so we build for the old end. From memory (assumed, Task 1 verifies): Tizen 5.5 is about Chromium 69, 6.0 about 76, 6.5 about 85. Consequences: set Vite `build.target` to `chrome69` with `@vitejs/plugin-legacy`/core-js polyfills where needed; replace Tailwind v4 (needs about Chrome 111+) with Tailwind v3 or plain compiled CSS; avoid `gap` on flex, `aspect-ratio`, `:is()`, `inset`, optional chaining left untranspiled; test `backdrop-filter` (may need `-webkit-` prefix or the pre-blurred fallback). Tizen 5.0 and older (Chromium 63 and below) is out of scope unless the user's TV needs it.
6. **TV layout:** left icon rail (replaces 260px sidebar), bottom focusable now-playing bar (replaces floating pill), full-screen now-playing + lyrics, big type (body at least 26px at 1080p). Focus ring + scale on `transform` only.
7. **Frosted glass without live blur where it hurts.** Pre-blurred, downscaled artwork behind translucent panels; test real `backdrop-filter` on the TV before keeping it.
8. **Recommendations from local history.** Store plays on the TV (localStorage/IndexedDB): track, artist, completion %, time. "For you" = seed YouTube Music radio/`next` from top recent tracks, weight by completion and recency, drop already-heard-today, mix with artist affinity. No account needed. (Optional later: QR sign-in for YouTube's own feed.)
9. **Performance budget:** cold start under 3s, JS under 300KB gzipped (React kept; revisit Preact if over), heap under 150MB after 30 min, 60fps scrolling, input latency under 100ms.
10. **Sideload only.** Developer Mode + `sdb`/Tizen Studio install. No Seller Office, no store certification. Source stays public under GPLv3.

## Dependency Graph
```
T0 Repo inspection (DONE)
  └─ T1 Fork + Tizen shell (build target, CSS, focus smoke test, read UA)
       ├─ T2 SPIKE: backend resolver + audio plays on TV   <- highest risk
       │     └─ T4 Search -> play
       │           ├─ T5 Now Playing + queue
       │           │     ├─ T7 Lyrics
       │           │     └─ T8 History + recommendations ("For you")
       │           └─ T6 Home / album / artist pages
       └─ T3 TV design system (tokens, rail, bar, focus engine)
T9 Gapless + settings (quality, sleep timer, stats) <- T5
T10 Performance pass on the TV <- all
T11 Sideload packaging + install guide <- T10
```

## Task List
See `tasks/todo.md`.

### Phase 0: De-risk
- [x] Task 0: Repo inspection (findings above)
- [ ] Task 1: Fork + Tizen shell
- [ ] Task 2: SPIKE one track plays on the TV
### Checkpoint: Feasibility
- [ ] Audio plays on the real TV; codec and IP-binding answers recorded.

### Phase 1: Listening loop
- [ ] Task 3: TV design system + focus engine
- [ ] Task 4: Search to play
- [ ] Task 5: Now Playing + queue
### Checkpoint: Core loop
- [ ] Remote-only search, play, queue, skip. Budget measured.

### Phase 2: BitChord feel
- [ ] Task 6: Home + album/artist pages
- [ ] Task 7: Synced lyrics
- [ ] Task 8: Listening history + recommendations
- [ ] Task 9: Gapless + settings
### Checkpoint: Parity of core design
- [ ] Human review of the TV UI against the BitChord web/Android look.

### Phase 3: Ship
- [ ] Task 10: Performance pass on the TV
- [ ] Task 11: Sideload package + guide
### Checkpoint: Complete

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| YouTube changes break resolving (unofficial API) | High | Pin YouTube.js, backend only, quick-update path; fixtures + parser tests from the repo |
| Opus/WebM not playable on Tizen 6.5 | High | Spike first; ffmpeg AAC fallback in backend |
| Stream URL IP-bound, TV and backend on different IPs | Med | Backend on LAN; `/stream` proxy fallback |
| Tailwind v4 / React 19 need newer Chromium than TV has | High | Read UA in T1; set build target; swap CSS pipeline if needed |
| Live blur drops FPS | Med | Pre-blurred artwork; measure on TV |
| Age-restricted tracks fail without sign-in | Low | Show clear message, skip to next (matches web app behavior) |
| GPLv3 obligations | Low (sideload) | Keep fork public, keep LICENSE and notices |
| Using BitChord name/logo | Low | Name the fork clearly as unofficial; keep the upstream credit |
| TV is 2023 but user says Tizen 6.5 (2023 models usually ship Tizen 7.0, assumed) | Low | T1 prints the real platform version; adjust target |

## Answered
- Backend: BitChord's backend can't resolve streams (see decision 2). On-device first, Windows PC backend as fallback.
- Developer Mode: enabled. Target: Tizen 6 or older (floor Tizen 5.5, see decision 5). TV model: unknown, Task 1 reads it from the TV. Name: "BitChord TV".

## Open Questions
1. TV IP address (needed to install in Task 1). Model is optional: the app prints it.
