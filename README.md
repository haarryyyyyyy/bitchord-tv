# BitChord TV

An unofficial Samsung Tizen TV port of [BitChord](https://github.com/kushagrasinghx/BitChord) (GPLv3), the open-source YouTube Music client.
It is built for the remote: D-pad navigation, media keys, and a 1920×1080 layout in BitChord's Apple Music style.

Not affiliated with Google, YouTube, JioSaavn or Samsung. It streams from their public endpoints, so it can stop working when they change them.

The interface follows BitChord's own Android TV module (`tv/`, Compose for TV), which is Apple Music on tvOS. That means a tab bar at the top, cards that lift when focused, white "platter" buttons, a canvas tinted by the artwork, and a Now Playing screen whose controls hide when idle.

## Using the remote

| Where | Key | Does |
| --- | --- | --- |
| Anywhere | ▲ from a page's top row | Goes to the tab bar (Home, Explore, Library, Now Playing, Search, Settings) |
| Tab bar | ◀ ▶ | Home, Explore and Library switch as soon as they're focused |
| Tab bar | ▼ | Enters the page at its top |
| Any song | Hold OK | Song menu: Play Next, Add to Queue, Start Radio, Favourite, Go to Album/Artist |
| Search | OK on keys | Types; results update as you type |
| Now Playing, controls hidden | ◀ ▶ | Previous / next song |
| Now Playing, controls hidden | OK, ▲ or ▼ | Shows the controls |
| Now Playing, on the progress bar | ◀ ▶ | Scrub 10 s at a time |
| Now Playing, on the progress bar | OK | Play / pause |
| Now Playing, on the progress bar | ▼ | Up Next |
| Back | — | Closes Up Next, then the controls, then Now Playing; pops a page; goes to the tab bar; then Home; twice on Home exits |
| Media keys | ▶❚❚ ◀◀ ▶▶ ⏮ ⏭ | Work everywhere |

## What it does

- **YouTube Music**: search for songs, albums, artists and playlists; browse the home feed; album, playlist and artist pages; radio.
- **JioSaavn**: search, and plays its 320 kbps AAC.
- **JioSaavn swap**: when a YouTube song has the same recording on JioSaavn (title, artist and length within 3 s agree, using BitChord's `TrackMatcher`), the app plays JioSaavn's 320 kbps copy instead. You can turn this off in Settings.
- **Recommendations from your listening history**:
  - "Made for You" mixes YouTube Music radios seeded by the songs you play most fully and most recently.
  - Home also shows "Because you played …", "Recently Played" and "Your Top Artists".
  - All of this is stored on the TV. No account is used.
- **Now Playing**:
  - Ambient artwork background.
  - Synced lyrics from LRCLIB.
  - Up Next queue.
  - Shuffle, repeat and like buttons.
  - The audio source and bitrate are shown.
- **AutoPlay**: plays radio when the queue ends.
- **Explore**: new albums and singles, trending, and every YouTube Music mood and genre.
- **Library**: favourite songs, saved albums and playlists, recently played.
- **Search** with an on-screen keyboard, suggestions and recent searches.
- **Themes**: Dynamic Artwork, Pure Black (OLED) and Midnight, from BitChord TV.
- **Sleep timer**.
- **Settings > Diagnostics** shows the device info and an error log.

Dropped from BitChord: sign-in, Listen Together, downloads, addons, crossfade and gapless.

## Install on the TV (sideload)

1. On the TV, enable Developer Mode:
   1. Open Apps.
   2. Press `1 2 3 4 5` on the remote.
   3. Turn Developer Mode on and enter your PC's IP address.
   4. Restart the TV.
2. Install Tizen Studio with the TV Extensions. In Certificate Manager, create a **Samsung** certificate profile and add your TV's DUID.
3. Build the app:
   ```bash
   npm install
   npm run build        # tests are separate: npm test
   ```
   This produces `dist/` (the app) and `BitChordTV.wgt` (an unsigned package).
4. Sign and install the app, using either the CLI or Tizen Studio:
   - **CLI** (the Tizen CLI is in `tizen-studio/tools/ide/bin`):
     ```bash
     sdb connect <TV_IP>
     tizen package -t wgt -s <your-profile> -- dist
     tizen install -n dist/BitChordTV.wgt -t <TV_NAME_FROM_sdb_devices>
     ```
   - **Tizen Studio**:
     1. Choose File > Import > Tizen > Tizen Project, and select the `dist` folder.
     2. Right-click the project and choose Run As > Tizen Web Application.

GitHub Actions builds the unsigned `.wgt` and `dist/` on every push (Actions > latest run > Artifacts). You still have to sign it with your own certificate (step 4).

## Develop

```bash
npm run dev     # http://localhost:5173, the API calls go through Vite's proxy
npm test        # unit tests, including parsers checked against captured YouTube Music responses (fixtures/)
LIVE=1 npx vitest run live   # checks the real services
node scripts/capture.mjs     # refreshes the fixtures when YouTube changes its responses
```

Use the arrow keys, Enter, and Escape (for Back) to drive it in a browser.

| Path | What |
| --- | --- |
| `src/sources/ytm.ts` | YouTube Music InnerTube client (WEB_REMIX for browsing, VISIONOS for streams) |
| `src/sources/jiosaavn.ts` | JioSaavn API, DES URL decrypt and 320 kbps selection (ported from BitChord) |
| `src/sources/match.ts` | BitChord's TrackMatcher, copied |
| `src/sources/resolve.ts` | Picks the stream: the JioSaavn swap, then YouTube |
| `src/recommend.ts` | History-based recommendations |
| `src/player.ts` | Queue, `<audio>`, AutoPlay, history logging |
| `src/focus.ts` | Remote-control spatial navigation |
| `src/ui/` | Screens and components |
| `public/config.xml` | Tizen manifest |

## Errors you might see, and what they mean

All errors are also written to **Settings > Diagnostics > Log**. Read that first.

| Message / symptom | Likely cause | What to try |
| --- | --- | --- |
| Install fails: "certificate" / "signature" / "author" error | The package isn't signed with a Samsung certificate that includes this TV's DUID | Re-create the certificate profile with the TV's DUID, then repackage. |
| Install fails: "required version" | The TV's Tizen is older than 5.0 | Lower `required_version` in `public/config.xml` (unsupported below 5.5). |
| Blank black screen on launch | The JavaScript doesn't run on this TV's browser engine | Check the Chromium version in Settings > Diagnostics if you can reach it; otherwise use remote inspection: `tizen run` + Chrome `chrome://inspect`. Report the version. |
| "JioSaavn search failed" in the log, and no "From JioSaavn" row | The TV blocks cross-origin calls to jiosaavn.com (JioSaavn sends no CORS headers) | YouTube Music keeps working. Tell me and a fallback can be added. |
| "HTTP 403 from music.youtube.com" | YouTube rejected the request origin | Should not happen on the TV (it sends `Origin: null`, which YouTube allows). Happens in desktop browsers without the dev proxy. |
| "Sign in to confirm you're not a bot" | YouTube flagged the visitor session | The app drops the session and makes a new one on the next try. Wait a minute and press Play again. |
| "This video is unavailable" / "not available in your country" | A region lock or takedown | Normal: the song is skipped. |
| "YouTube sent no playable audio for this track" | No direct audio format was offered | The VISIONOS client may have changed; this needs an app update. |
| "Audio error 4" then "switched to AAC" | The TV can't decode Opus | Handled automatically; keep "Opus audio" off. |
| "Audio error 2" / "Playback failed" | Network drop, or the stream URL expired | The app moves to the next song; replay it. |
| "Press Play to start" | The TV blocked autoplay before the first key press | Press Play. |
| Artwork stays blank in places | Google's image servers rate-limit bursts (HTTP 429) | Images load a few at a time and retry once; scrolling back reloads them. |
| "Timed out after 8s" | Slow network | Try again. The Retry button on the error screen reloads. |
| No lyrics | LRCLIB has nothing for this exact recording. The app now refuses lyrics whose title, artist or length don't match, so it shows none rather than another song's | Expected for many songs. The Lyrics button stays dimmed. |
| A press moves focus two steps | Only seen with the dev server's hot reload | Reload the page; the TV build is unaffected. |
| Focus seems lost (nothing highlighted) | A page finished loading after you moved | Press any arrow: focus returns to the page, or press ▲ for the tab bar. |
| Music stops when you press Home | Intentional: the app pauses when hidden so audio never plays over other apps | — |

## Licence

GPL-3.0, as a derivative of BitChord. See `LICENSE`.
