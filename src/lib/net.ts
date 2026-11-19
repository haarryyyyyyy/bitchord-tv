// HTTP with a timeout. In `vite dev` the API hosts go through the dev proxy (vite.config.ts),
// because a desktop browser page is not allowed to call them directly; the TV app calls them directly.
const DEV_HOSTS: Record<string, string> = {
  'https://music.youtube.com': '/_ytm',
  'https://www.youtube.com': '/_yt',
  'https://www.jiosaavn.com': '/_saavn',
  'https://lrclib.net': '/_lrclib',
}

const isDev = typeof import.meta !== 'undefined' && !!(import.meta as any).env?.DEV && typeof window !== 'undefined'

function route(url: string): string {
  if (!isDev) return url
  for (const host in DEV_HOSTS) if (url.indexOf(host) === 0) return DEV_HOSTS[host] + url.slice(host.length)
  return url
}

export class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`HTTP ${status} from ${url.replace(/^https?:\/\//, '').split(/[?/]/)[0]}`)
  }
}

export async function request(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = setTimeout(() => ctl && ctl.abort(), timeoutMs)
  try {
    const res = await fetch(route(url), { credentials: 'omit', ...init, signal: ctl ? ctl.signal : undefined })
    if (!res.ok) throw new HttpError(res.status, url)
    return res
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error(`Timed out after ${timeoutMs / 1000}s: ${url.split('?')[0]}`)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export const getJson = async <T = any>(url: string, timeoutMs?: number): Promise<T> => (await request(url, {}, timeoutMs)).json()

// text/plain keeps it a "simple" request: no CORS preflight (youtubei answers preflights with 400).
export const postJson = async <T = any>(url: string, body: unknown, timeoutMs?: number): Promise<T> =>
  (await request(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body) }, timeoutMs)).json()

export const qs = (params: Record<string, string | number>) =>
  Object.keys(params)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k])))
    .join('&')
