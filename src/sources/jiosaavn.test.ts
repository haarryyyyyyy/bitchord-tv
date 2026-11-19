import { describe, expect, it } from 'vitest'
import CryptoJS from 'crypto-js'
import { decryptUrl, selectBestStream, toTrack } from './jiosaavn'

describe('decryptUrl', () => {
  it('round-trips DES/ECB/PKCS7 with the JioSaavn key', () => {
    const plain = 'http://aac.saavncdn.com/123/abc_96.mp4'
    const enc = CryptoJS.DES.encrypt(plain, CryptoJS.enc.Utf8.parse('38346591'), {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    }).toString()
    expect(decryptUrl(enc)).toBe(plain)
  })
  it('returns empty for blank or garbage input', () => {
    expect(decryptUrl('')).toBe('')
    expect(decryptUrl('not-base64!!')).toBe('')
  })
})

describe('selectBestStream', () => {
  it('rewrites to 320 only when the catalogue says it exists', () => {
    expect(selectBestStream('https://x/a_96.mp4', true)).toEqual({ url: 'https://x/a_320.mp4', kbps: 320 })
    expect(selectBestStream('https://x/a_96.mp4', false)).toEqual({ url: 'https://x/a_96.mp4', kbps: 96 })
  })
  it('keeps query strings', () => {
    expect(selectBestStream('https://x/a_96.mp4?token=1', true)).toEqual({ url: 'https://x/a_320.mp4?token=1', kbps: 320 })
  })
  it('does not claim a bitrate for unknown URLs', () => {
    expect(selectBestStream('https://x/a.mp4', true)).toEqual({ url: 'https://x/a.mp4', kbps: null })
    expect(selectBestStream('', true)).toBeNull()
  })
})

describe('toTrack', () => {
  it('maps a catalogue row and unescapes HTML entities', () => {
    const t = toTrack({
      id: 'k1',
      title: 'Kesariya (From &quot;Brahmastra&quot;)',
      image: 'http://c/x-150x150.jpg',
      explicit_content: '1',
      more_info: { album: 'Alb', duration: '215', artistMap: { primary_artists: [{ name: 'A' }, { name: 'B' }] } },
    })
    expect(t).toMatchObject({ id: 'k1', title: 'Kesariya (From "Brahmastra")', artist: 'A, B', album: 'Alb', durationSec: 215, explicit: true })
    expect(t.image).toBe('https://c/x-500x500.jpg')
  })
})
