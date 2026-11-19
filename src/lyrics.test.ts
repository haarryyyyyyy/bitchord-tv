import { describe, expect, it } from 'vitest'
import { lineAt, parseLrc } from './lyrics'

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
