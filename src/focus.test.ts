import { describe, expect, it } from 'vitest'
import { pickNext } from './focus'

const r = (left: number, top: number, w = 100, h = 100): DOMRect => ({ left, top, width: w, height: h, right: left + w, bottom: top + h }) as DOMRect

describe('pickNext', () => {
  const grid = [r(0, 0), r(200, 0), r(0, 200), r(200, 200)]
  it('moves along rows and columns', () => {
    expect(pickNext(grid[0], [grid[1], grid[2], grid[3]], 'right')).toBe(0)
    expect(pickNext(grid[0], [grid[1], grid[2], grid[3]], 'down')).toBe(1)
  })
  it('returns -1 at an edge', () => {
    expect(pickNext(grid[0], [grid[1], grid[2], grid[3]], 'left')).toBe(-1)
    expect(pickNext(grid[0], [grid[1], grid[2], grid[3]], 'up')).toBe(-1)
  })
  it('prefers the element in line over a nearer diagonal one', () => {
    expect(pickNext(grid[0], [r(150, 180), grid[1]], 'right')).toBe(1)
  })
  it('reaches a wide element below from any card above it', () => {
    expect(pickNext(r(800, 0), [r(0, 200, 1600, 80), r(0, 0)], 'down')).toBe(0)
  })
})
