import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchFromOFF } from '@/lib/ai/openFoodFacts'

describe('fetchFromOFF', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns null when request times out', async () => {
    vi.useFakeTimers()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const resultPromise = fetchFromOFF('1234567890123')
    await vi.advanceTimersByTimeAsync(8000)
    const result = await resultPromise

    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(warnSpy).toHaveBeenCalledWith(
      'OpenFoodFacts request timed out',
      expect.objectContaining({
        barcode: '1234567890123',
        timeoutMs: 8000,
      })
    )
  })

  it('returns null and logs non-timeout failures', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')))

    const result = await fetchFromOFF('4000000000002')

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to fetch from OpenFoodFacts',
      expect.objectContaining({
        barcode: '4000000000002',
        errorMessage: 'Network down',
        errorType: 'Error',
      })
    )
  })
})
