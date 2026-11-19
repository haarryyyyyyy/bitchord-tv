import { describe, expect, it } from 'vitest'
import { lineAt, parseLrc, pickLyricsRow } from './lyrics'

describe('LRC', () => {
  const lines = parseLrc('[ar: x]\n[00:01.50]one\n[00:04.2]two\n[00:10.123][00:20.00]chorus\n\n[00:12.00]')
  it('parses timestamps, repeats and blank lines', () => {
    expect(lines.map((l) => [l.t, l.text])).toEqual([
      [1.5, 'one'],
      [4.2, 'two'],
      [10.123, 'chorus'],
      [12, ''],
      [20, 'chorus'],
    ])
  })
  it('finds the current line', () => {
    expect(lineAt(lines, 0)).toBe(-1)
    expect(lineAt(lines, 1.5)).toBe(0)
    expect(lineAt(lines, 11)).toBe(2)
    expect(lineAt(lines, 99)).toBe(4)
  })
})

describe('pickLyricsRow (the wrong-lyrics bug)', () => {
  const song = { title: 'Kesariya (From "Brahmastra")', artist: 'Arijit Singh', durationSec: 268 }
  const row = (trackName: string, artistName: string, duration: number, synced = true) => ({ trackName, artistName, duration, syncedLyrics: synced ? '[00:01.00]x' : null, plainLyrics: 'x' })

  it('refuses other songs by the same artist and other takes', () => {
    expect(pickLyricsRow([row('Apna Bana Le', 'Arijit Singh', 268), row('Kesariya (Lofi Flip)', 'Arijit Singh', 240)], song)).toBeNull()
  })
  it('refuses the same title by someone else or at another length', () => {
    expect(pickLyricsRow([row('Kesariya', 'Someone Else', 268), row('Kesariya', 'Arijit Singh', 320)], song)).toBeNull()
  })
  it('takes the same recording, synced first', () => {
    const plain = row('Kesariya', 'Arijit Singh', 269, false)
    const synced = row('Kesariya', 'Pritam, Arijit Singh', 270)
    expect(pickLyricsRow([plain, synced], song)).toBe(synced)
  })
})
