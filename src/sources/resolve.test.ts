import { describe, expect, it } from 'vitest'
import { pickSameRecording } from './resolve'
import type { Track } from './types'

const row = (id: string, title: string, artist: string, durationSec: number, album?: string): Track => ({ source: 'saavn', id, title, artist, durationSec, album, image: '', explicit: false })

describe('pickSameRecording (JioSaavn swap)', () => {
  const target = { title: 'Kesariya (From "Brahmastra")', artist: 'Arijit Singh', durationSec: 269 }

  it('takes the same recording', () => {
    const rows = [row('a', 'Kesariya (Lofi Flip)', 'VIBIE, Arijit Singh', 240), row('b', 'Kesariya', 'Pritam, Arijit Singh, Amitabh Bhattacharya', 268, 'Brahmastra')]
    expect(pickSameRecording(rows, target)!.id).toBe('b')
  })

  it('refuses a different take or length', () => {
    expect(pickSameRecording([row('a', 'Kesariya (Lofi Flip)', 'Arijit Singh', 240)], target)).toBeNull()
    expect(pickSameRecording([row('a', 'Kesariya', 'Arijit Singh', 300)], target)).toBeNull()
  })

  it('refuses another artist with the same title', () => {
    expect(pickSameRecording([row('a', 'Kesariya', 'Someone Else', 269)], target)).toBeNull()
  })
})
