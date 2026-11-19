// Artwork colour without CSS filters: the image is drawn into a tiny canvas once.
// An 8×8 canvas stretched to the screen is the "mesh" backdrop (the GPU's bilinear
// scaling blurs it for free); its average, nudged towards its most vivid pixel, tints the canvas.
const colorCache = new Map<string, Promise<[number, number, number]>>()

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('artwork failed'))
    img.src = url
  })
}

export async function drawMesh(canvas: HTMLCanvasElement, url: string): Promise<void> {
  const img = await load(url)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
}

export function artColor(url: string): Promise<[number, number, number]> {
  if (!url) return Promise.resolve([38, 39, 44])
  let p = colorCache.get(url)
  if (!p) {
    p = load(url).then((img) => {
      const c = document.createElement('canvas')
      c.width = c.height = 6
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0, 6, 6)
      const d = ctx.getImageData(0, 0, 6, 6).data
      let r = 0
      let g = 0
      let b = 0
      let best = [0, 0, 0]
      let bestSat = -1
      for (let i = 0; i < d.length; i += 4) {
        r += d[i]
        g += d[i + 1]
        b += d[i + 2]
        const max = Math.max(d[i], d[i + 1], d[i + 2])
        const sat = max ? (max - Math.min(d[i], d[i + 1], d[i + 2])) / max : 0
        if (sat * max > bestSat) (bestSat = sat * max), (best = [d[i], d[i + 1], d[i + 2]])
      }
      const n = d.length / 4
      return [Math.round((r / n + best[0]) / 2), Math.round((g / n + best[1]) / 2), Math.round((b / n + best[2]) / 2)] as [number, number, number]
    })
    p.catch(() => colorCache.delete(url))
    colorCache.set(url, p)
  }
  return p
}
