import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

describe('sanity', () => {
  it('confirms the test runner is working', () => {
    assert.strictEqual(1 + 1, 2)
  })
})
