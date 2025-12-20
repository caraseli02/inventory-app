/**
 * Unit Tests: Logger
 *
 * Tests for the structured logging utility.
 * Verifies log level filtering and output formatting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to mock import.meta.env before importing the logger
const mockEnv = { DEV: true }

vi.mock('import.meta', () => ({
  env: mockEnv,
}))

describe('Logger', () => {
  // Store original console methods
  const originalDebug = console.debug
  const originalInfo = console.info
  const originalWarn = console.warn
  const originalError = console.error

  // Mock functions
  let mockDebug: ReturnType<typeof vi.fn>
  let mockInfo: ReturnType<typeof vi.fn>
  let mockWarn: ReturnType<typeof vi.fn>
  let mockError: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Create fresh mocks for each test
    mockDebug = vi.fn()
    mockInfo = vi.fn()
    mockWarn = vi.fn()
    mockError = vi.fn()

    console.debug = mockDebug
    console.info = mockInfo
    console.warn = mockWarn
    console.error = mockError
  })

  afterEach(() => {
    // Restore original console methods
    console.debug = originalDebug
    console.info = originalInfo
    console.warn = originalWarn
    console.error = originalError

    vi.resetModules()
  })

  describe('Log Output', () => {
    it('should log debug messages with correct prefix', async () => {
      // Import fresh module to get new logger instance
      const { logger } = await import('@/lib/logger')

      logger.debug('Test debug message')

      expect(mockDebug).toHaveBeenCalledWith(
        '[DEBUG] Test debug message',
        expect.anything()
      )
    })

    it('should log info messages with correct prefix', async () => {
      const { logger } = await import('@/lib/logger')

      logger.info('Test info message')

      expect(mockInfo).toHaveBeenCalledWith(
        '[INFO] Test info message',
        expect.anything()
      )
    })

    it('should log warn messages with correct prefix', async () => {
      const { logger } = await import('@/lib/logger')

      logger.warn('Test warning message')

      expect(mockWarn).toHaveBeenCalledWith(
        '[WARN] Test warning message',
        expect.anything()
      )
    })

    it('should log error messages with correct prefix', async () => {
      const { logger } = await import('@/lib/logger')

      logger.error('Test error message')

      expect(mockError).toHaveBeenCalledWith(
        '[ERROR] Test error message',
        expect.anything()
      )
    })
  })

  describe('Context Object', () => {
    it('should include context object when provided', async () => {
      const { logger } = await import('@/lib/logger')
      const context = { userId: '123', action: 'login' }

      logger.info('User action', context)

      expect(mockInfo).toHaveBeenCalledWith('[INFO] User action', context)
    })

    it('should handle empty context', async () => {
      const { logger } = await import('@/lib/logger')

      logger.info('No context')

      expect(mockInfo).toHaveBeenCalledWith('[INFO] No context', '')
    })

    it('should handle complex context objects', async () => {
      const { logger } = await import('@/lib/logger')
      const context = {
        product: {
          id: '123',
          name: 'Test Product',
        },
        quantity: 10,
        timestamp: new Date().toISOString(),
      }

      logger.debug('Complex context', context)

      expect(mockDebug).toHaveBeenCalledWith('[DEBUG] Complex context', context)
    })
  })

  describe('All Log Levels', () => {
    it('should expose all four log methods', async () => {
      const { logger } = await import('@/lib/logger')

      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
    })

    it('should call correct console method for each level', async () => {
      const { logger } = await import('@/lib/logger')

      logger.debug('debug')
      logger.info('info')
      logger.warn('warn')
      logger.error('error')

      expect(mockDebug).toHaveBeenCalledTimes(1)
      expect(mockInfo).toHaveBeenCalledTimes(1)
      expect(mockWarn).toHaveBeenCalledTimes(1)
      expect(mockError).toHaveBeenCalledTimes(1)
    })
  })

  describe('Message Formatting', () => {
    it('should handle empty messages', async () => {
      const { logger } = await import('@/lib/logger')

      logger.info('')

      expect(mockInfo).toHaveBeenCalledWith('[INFO] ', '')
    })

    it('should handle messages with special characters', async () => {
      const { logger } = await import('@/lib/logger')
      const specialMessage = 'Test with "quotes" and <brackets> & symbols'

      logger.info(specialMessage)

      expect(mockInfo).toHaveBeenCalledWith(
        `[INFO] ${specialMessage}`,
        expect.anything()
      )
    })

    it('should handle multi-line messages', async () => {
      const { logger } = await import('@/lib/logger')
      const multiLine = 'Line 1\nLine 2\nLine 3'

      logger.info(multiLine)

      expect(mockInfo).toHaveBeenCalledWith(
        `[INFO] ${multiLine}`,
        expect.anything()
      )
    })
  })
})
