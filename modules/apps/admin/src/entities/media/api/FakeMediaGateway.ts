import { asId, toIsoDateTime } from '@vidya/domain'

import type { Clock } from '@/shared/lib'
import { systemClock } from '@/shared/lib'

import type {
  MediaGateway,
  MediaId,
  MediaKind,
  MediaPage,
  MediaQuery,
  MediaRecord,
  UploadRequest,
} from '../types'
import { MediaError } from '../types'
import { FailingUploadPrefix, mediaFixtures, MediaPageSize } from './fixtures'

/** How far the bar moves each time the clock ticks, and how long a tick is. */
const ProgressStep = 20
const TickMs = 50

/** The refused upload gets this far first, so a cancel and a retry are both reachable. */
const FailAtPercent = 60

interface FakeMediaGatewayOptions {
  clock?: Clock
}

const detectKind = (type: string): MediaKind => {
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  return 'image'
}

const fails = (name: string): boolean => name.toLowerCase().startsWith(FailingUploadPrefix)

/**
 * Storage as the editor will experience it, standing in for a server that has none.
 *
 * Files live for as long as the tab does. A record therefore carries the
 * `/media/<id>` path a real backend would serve, and the blob url stays behind
 * `resolve` — writing it into a block would save an address that dies with the
 * tab, and a reopened lesson would show a broken image with no way back.
 */
export class FakeMediaGateway implements MediaGateway {
  private readonly clock: Clock
  private uploaded: MediaRecord[] = []
  private readonly blobs = new Map<string, string>()

  constructor(options: FakeMediaGatewayOptions = {}) {
    this.clock = options.clock ?? systemClock
    this.loadFromStorage()
  }

  upload(request: UploadRequest): Promise<MediaRecord> {
    return new Promise<MediaRecord>((resolve, reject) => {
      this.run(request, resolve, reject)
    })
  }

  async list(query: MediaQuery): Promise<MediaPage> {
    const page = Math.max(1, query.page ?? 1)
    const matching = this.all().filter((record) => this.matches(record, query))
    const from = (page - 1) * MediaPageSize

    return {
      items: matching.slice(from, from + MediaPageSize),
      total: matching.length,
      page,
      pageSize: MediaPageSize,
    }
  }

  /**
   * An address something can actually load, or nothing when the file is gone.
   *
   * A url this session never held is not an error: it is what every `/media/<id>`
   * saved before a reload becomes, and the block says so rather than breaking.
   */
  resolve(url: string): string | undefined {
    const target = url.trim()
    if (!target) return undefined
    if (!target.startsWith('/media/')) return target

    const held = this.blobs.get(target)
    if (held) return held

    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(`vidya.fake_media.${target}`)
        if (stored) {
          this.blobs.set(target, stored)
          return stored
        }
      } catch {
        // storage quota
      }
    }

    return undefined
  }

  private all(): MediaRecord[] {
    return [...this.uploaded, ...mediaFixtures]
  }

  private matches(record: MediaRecord, query: MediaQuery): boolean {
    if (query.kind && record.kind !== query.kind) return false

    const term = query.term?.trim().toLowerCase()
    return !term || record.name.toLowerCase().includes(term)
  }

  private run(
    request: UploadRequest,
    resolve: (record: MediaRecord) => void,
    reject: (reason: MediaError) => void,
  ): void {
    let percent = 0
    let scheduled: { cancel: () => void } | undefined

    const stop = (reason: string) => {
      scheduled?.cancel()
      reject(new MediaError(reason))
    }

    if (request.signal?.aborted) return stop('media-upload-cancelled')
    request.signal?.addEventListener('abort', () => stop('media-upload-cancelled'), { once: true })

    const tick = () => {
      if (request.signal?.aborted) return
      if (fails(request.file.name) && percent >= FailAtPercent) return stop('media-upload-failed')
      if (percent >= 100) return resolve(this.store(request.file))

      percent = Math.min(100, percent + ProgressStep)
      request.onProgress?.(percent)
      scheduled = this.clock.schedule(tick, TickMs)
    }

    request.onProgress?.(percent)
    scheduled = this.clock.schedule(tick, TickMs)
  }

  private store(file: File): MediaRecord {
    const id = asId<MediaId>(crypto.randomUUID())
    const record: MediaRecord = {
      id,
      kind: detectKind(file.type),
      url: `/media/${id}`,
      name: file.name,
      sizeBytes: file.size,
      createdAt: toIsoDateTime(new Date()),
    }

    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      try {
        this.blobs.set(record.url, URL.createObjectURL(file))
      } catch {
        // ignore
      }
    }

    this.saveBlobToIdb(record.url, file)

    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          this.blobs.set(record.url, reader.result)
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(`vidya.fake_media.${record.url}`, reader.result)
            } catch {
              // quota
            }
          }
        }
      }
      reader.readAsDataURL(file)
    }

    this.uploaded.unshift(record)
    this.saveRecords()
    return record
  }

  private saveBlobToIdb(key: string, file: Blob): void {
    if (typeof indexedDB === 'undefined') return
    try {
      const req = indexedDB.open('vidya.fake_media_blobs', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('blobs')
      }
      req.onsuccess = () => {
        try {
          const db = req.result
          const tx = db.transaction('blobs', 'readwrite')
          tx.objectStore('blobs').put(file, key)
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  private saveRecords(): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem('vidya.fake_media_records', JSON.stringify(this.uploaded))
    } catch {
      // quota
    }
  }

  private loadFromStorage(): void {
    this.loadRecordsFromLocalStorage()
    this.loadBlobsFromIndexedDb()
  }

  private loadRecordsFromLocalStorage(): void {
    if (typeof localStorage === 'undefined') return
    try {
      const raw = localStorage.getItem('vidya.fake_media_records')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        this.uploaded = parsed
      }
    } catch {
      // ignore
    }
  }

  private loadBlobsFromIndexedDb(): void {
    if (typeof indexedDB === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      return
    }
    try {
      const req = indexedDB.open('vidya.fake_media_blobs', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('blobs')
      req.onsuccess = () => this.hydrateBlobsFromDb(req.result)
    } catch {
      // ignore
    }
  }

  private hydrateBlobsFromDb(db: IDBDatabase): void {
    try {
      const tx = db.transaction('blobs', 'readonly')
      const store = tx.objectStore('blobs')
      for (const item of this.uploaded) {
        const getReq = store.get(item.url)
        getReq.onsuccess = () => {
          if (!getReq.result || this.blobs.has(item.url)) return
          try {
            this.blobs.set(item.url, URL.createObjectURL(getReq.result))
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }
}
