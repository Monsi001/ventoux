// Simple in-memory fetch cache to avoid duplicate requests across components
// Cache is per-session (resets on page reload)

interface CacheEntry {
  data: any
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<any>>()

const DEFAULT_TTL = 30_000 // 30 seconds

export async function cachedFetch(url: string, ttl = DEFAULT_TTL): Promise<any> {
  // Return cached data if fresh
  const cached = cache.get(url)
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data
  }

  // Deduplicate in-flight requests
  const existing = inflight.get(url)
  if (existing) return existing

  const promise = fetch(url)
    .then(res => res.json())
    .then(data => {
      cache.set(url, { data, timestamp: Date.now() })
      inflight.delete(url)
      return data
    })
    .catch(err => {
      inflight.delete(url)
      throw err
    })

  inflight.set(url, promise)
  return promise
}

export function invalidateCache(urlPrefix?: string) {
  if (!urlPrefix) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    if (key.startsWith(urlPrefix)) cache.delete(key)
  }
}
