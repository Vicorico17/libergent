import test from 'node:test'
import assert from 'node:assert/strict'
import { getMessageAttempt, finishMessageAttempt } from './message-attempt.ts'

test('message retries reuse persisted keys with account and content isolation', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  const entries = new Map()
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key)
  } })
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous); else delete globalThis.sessionStorage })
  const input = { userId: 'owner', target: '0722 123 456', listingUrl: 'https://listing.test/one', message: 'Hello' }
  const [first, parallel] = await Promise.all([getMessageAttempt(input), getMessageAttempt(input)])
  assert.equal(first.key, parallel.key)
  assert.equal((await getMessageAttempt({ ...input, target: '+40722123456' })).key, first.key)
  assert.equal((await getMessageAttempt(input)).key, first.key)
  for (const changes of [{ userId: 'other' }, { message: 'Another message' }, { listingUrl: 'https://listing.test/two' }]) {
    assert.notEqual((await getMessageAttempt({ ...input, ...changes })).key, first.key)
  }
  assert.doesNotMatch(JSON.stringify([...entries]), /Hello|0722|listing\.test|owner/)
  finishMessageAttempt(first)
  assert.notEqual((await getMessageAttempt(input)).key, first.key)
})

test('unavailable session storage prevents creating an untracked send', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get: () => { throw Error('Storage denied') } })
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous); else delete globalThis.sessionStorage })
  await assert.rejects(getMessageAttempt({ userId: 'owner', target: '+40722123456', listingUrl: '', message: 'Hello' }), /Activează stocarea/)
})
