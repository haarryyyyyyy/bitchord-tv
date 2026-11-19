// Captures real YouTube Music responses for parser tests: node scripts/capture.mjs (run from bitchord-tv)
import { writeFileSync } from 'node:fs'
const UA = 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.5 TV Safari/537.36'
let visitorData
async function call(ep, body) {
  const r = await fetch(`https://music.youtube.com/youtubei/v1/${ep}?prettyPrint=false`, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': UA },
    body: JSON.stringify({ context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20260707.12.00', hl: 'en', gl: 'IN', visitorData } }, ...body }),
  })
  const j = await r.json(); visitorData ||= j.responseContext?.visitorData; return j
}
const save = (n, j) => (writeFileSync(`fixtures/${n}.json`, JSON.stringify(j)), console.log(n, JSON.stringify(j).length))
save('home', await call('browse', { browseId: 'FEmusic_home' }))
const s = await call('search', { query: 'kesariya' }); save('search', s)
save('search-taylor', await call('search', { query: 'taylor swift' }))
const str = JSON.stringify(s)
const album = str.match(/"(MPREb_[\w-]+)"/)?.[1], artist = str.match(/"(UC[\w-]{22})"/)?.[1]
if (album) save('album', await call('browse', { browseId: album }))
if (artist) save('artist', await call('browse', { browseId: artist }))
save('playlist', await call('browse', { browseId: 'VLRDCLAK5uy_kmPRjHDECIcuVwnKsx2Ng7fyNgFKWNJFs' }))
save('next', await call('next', { videoId: 'BddP6PYo2gs', playlistId: 'RDAMVMBddP6PYo2gs', isAudioOnly: true, enablePersistentPlaylistPanel: true, tunerSettingValue: 'AUTOMIX_SETTING_NORMAL' }))
save('suggest', await call('music/get_search_suggestions', { input: 'arij' }))
