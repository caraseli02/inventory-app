/**
 * Vitest Test Setup
 *
 * This file runs before each test file and sets up the testing environment.
 * It includes DOM matchers, global mocks, and test utilities.
 */

import '@testing-library/jest-dom'
import { afterEach, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetIdCounter } from './factories'

// Reset ID counter before each test to ensure deterministic IDs
beforeEach(() => {
  resetIdCounter()
})

// Cleanup after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Mock window.matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver for components that use it
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

// Mock IntersectionObserver for lazy loading with proper constructor signature
type IntersectionObserverCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver
) => void

class IntersectionObserverMock implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin: string = '0px'
  readonly thresholds: ReadonlyArray<number> = [0]

  private callback: IntersectionObserverCallback

  // Options parameter intentionally unused - mock always simulates intersection
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    this.callback = callback
  }

  observe = vi.fn((target: Element) => {
    // Simulate immediate intersection for testing
    const entry: IntersectionObserverEntry = {
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRatio: 1,
      intersectionRect: target.getBoundingClientRect(),
      isIntersecting: true,
      rootBounds: null,
      target,
      time: Date.now(),
    }
    // Call callback asynchronously to simulate real behavior
    Promise.resolve().then(() => {
      this.callback([entry], this as unknown as IntersectionObserver)
    })
  })

  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [] as IntersectionObserverEntry[])
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: IntersectionObserverMock,
})

// Mock navigator.mediaDevices for camera tests
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn(),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  },
})

// Suppress console errors/warnings during tests unless explicitly testing them
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Suppress React "not wrapped in act()" warnings - these are noisy in tests
    // but we still want to see other errors
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: An update to') ||
        args[0].includes('act(...)'))
    ) {
      return
    }
    originalError(...args)
  }

  console.warn = (...args: unknown[]) => {
    // Suppress certain warnings that are expected in test environment
    if (
      typeof args[0] === 'string' &&
      args[0].includes('React does not recognize')
    ) {
      return
    }
    originalWarn(...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})

// Global test utilities
declare global {
  // Add custom matchers or utilities here if needed
}

export {}
