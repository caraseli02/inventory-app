/**
 * Unit Tests: Error Classes
 *
 * Tests for custom error classes used across the API layer.
 * These ensure errors are properly typed and behave as expected.
 */

import { describe, it, expect } from 'vitest'
import {
  ValidationError,
  NetworkError,
  AuthorizationError,
} from '@/lib/errors'

describe('Error Classes', () => {
  describe('ValidationError', () => {
    it('should create error with correct name', () => {
      const error = new ValidationError('Invalid input')

      expect(error.name).toBe('ValidationError')
      expect(error.message).toBe('Invalid input')
    })

    it('should be instance of Error', () => {
      const error = new ValidationError('Test')

      expect(error).toBeInstanceOf(Error)
    })

    it('should be instance of ValidationError', () => {
      const error = new ValidationError('Test')

      expect(error).toBeInstanceOf(ValidationError)
    })

    it('should not be instance of other error types', () => {
      const error = new ValidationError('Test')

      expect(error).not.toBeInstanceOf(NetworkError)
      expect(error).not.toBeInstanceOf(AuthorizationError)
    })

    it('should be catchable as ValidationError', () => {
      let caught = false

      try {
        throw new ValidationError('Invalid field')
      } catch (e) {
        if (e instanceof ValidationError) {
          caught = true
          expect(e.message).toBe('Invalid field')
        }
      }

      expect(caught).toBe(true)
    })

    it('should preserve stack trace', () => {
      const error = new ValidationError('Stack test')

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('ValidationError')
    })
  })

  describe('NetworkError', () => {
    it('should create error with correct name', () => {
      const error = new NetworkError('Connection failed')

      expect(error.name).toBe('NetworkError')
      expect(error.message).toBe('Connection failed')
    })

    it('should be instance of Error', () => {
      const error = new NetworkError('Test')

      expect(error).toBeInstanceOf(Error)
    })

    it('should be instance of NetworkError', () => {
      const error = new NetworkError('Test')

      expect(error).toBeInstanceOf(NetworkError)
    })

    it('should not be instance of other error types', () => {
      const error = new NetworkError('Test')

      expect(error).not.toBeInstanceOf(ValidationError)
      expect(error).not.toBeInstanceOf(AuthorizationError)
    })

    it('should be usable for network failure scenarios', () => {
      const messages = [
        'Failed to fetch',
        'Network request failed',
        'Timeout exceeded',
        'Connection refused',
      ]

      messages.forEach((msg) => {
        const error = new NetworkError(msg)
        expect(error.name).toBe('NetworkError')
        expect(error.message).toBe(msg)
      })
    })
  })

  describe('AuthorizationError', () => {
    it('should create error with correct name', () => {
      const error = new AuthorizationError('Access denied')

      expect(error.name).toBe('AuthorizationError')
      expect(error.message).toBe('Access denied')
    })

    it('should be instance of Error', () => {
      const error = new AuthorizationError('Test')

      expect(error).toBeInstanceOf(Error)
    })

    it('should be instance of AuthorizationError', () => {
      const error = new AuthorizationError('Test')

      expect(error).toBeInstanceOf(AuthorizationError)
    })

    it('should not be instance of other error types', () => {
      const error = new AuthorizationError('Test')

      expect(error).not.toBeInstanceOf(ValidationError)
      expect(error).not.toBeInstanceOf(NetworkError)
    })

    it('should be usable for auth failure scenarios', () => {
      const messages = [
        'Unauthorized',
        'Invalid API key',
        'Permission denied',
        'Session expired',
      ]

      messages.forEach((msg) => {
        const error = new AuthorizationError(msg)
        expect(error.name).toBe('AuthorizationError')
        expect(error.message).toBe(msg)
      })
    })
  })

  describe('Error Discrimination', () => {
    it('should allow proper error type checking in catch blocks', () => {
      const handleError = (error: Error): string => {
        if (error instanceof ValidationError) {
          return 'validation'
        }
        if (error instanceof NetworkError) {
          return 'network'
        }
        if (error instanceof AuthorizationError) {
          return 'authorization'
        }
        return 'unknown'
      }

      expect(handleError(new ValidationError('test'))).toBe('validation')
      expect(handleError(new NetworkError('test'))).toBe('network')
      expect(handleError(new AuthorizationError('test'))).toBe('authorization')
      expect(handleError(new Error('test'))).toBe('unknown')
    })

    it('should work with Promise rejections', async () => {
      const rejectWithValidation = () =>
        Promise.reject(new ValidationError('Invalid'))

      await expect(rejectWithValidation()).rejects.toThrow(ValidationError)
      await expect(rejectWithValidation()).rejects.toThrow('Invalid')
    })
  })
})
