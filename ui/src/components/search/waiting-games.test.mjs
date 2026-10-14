import assert from 'node:assert/strict'
import test from 'node:test'
import { movePlayer, nextCoin, shuffled, discountPercent, flipCard } from './waiting-games.ts'

test('movement stays inside the board and does not wrap rows', () => {
  assert.equal(movePlayer(0, 'ArrowUp'), 0)
  assert.equal(movePlayer(0, 'ArrowLeft'), 0)
  assert.equal(movePlayer(3, 'ArrowRight'), 3)
  assert.equal(movePlayer(15, 'ArrowDown'), 15)
  assert.equal(movePlayer(4, 'ArrowLeft'), 4)
  assert.equal(movePlayer(0, 'ArrowRight'), 1)
  assert.equal(movePlayer(1, 'ArrowDown'), 5)
  assert.equal(movePlayer(5, 'ArrowUp'), 1)
  assert.equal(movePlayer(5, 'ArrowLeft'), 4)
})

test('coins always spawn in reachable cells away from the player', () => {
  for (let player = 0; player < 16; player++) {
    for (let i = 0; i < 25; i++) {
      const coin = nextCoin(player)
      assert.ok(coin >= 0 && coin < 16)
      assert.notEqual(coin, player)
    }
  }
})

test('memory awards a pair only once and blocks duplicate flips', () => {
  const initial = { cards: [0, 1, 0, 1], open: [], matched: [] }
  const first = flipCard(initial, 0)
  assert.equal(first.points, 0)
  assert.equal(flipCard(first.state, 0).state, first.state)
  const pair = flipCard(first.state, 2)
  assert.equal(pair.points, 20)
  assert.deepEqual(pair.state.matched, [0, 2])
  assert.equal(flipCard(pair.state, 0).points, 0)
  assert.deepEqual(initial.open, [])
})

test('mismatches cannot award points or open a third card', () => {
  const first = flipCard({ cards: [0, 1, 0, 1], open: [], matched: [] }, 0)
  const mismatch = flipCard(first.state, 1)
  assert.equal(mismatch.points, 0)
  assert.deepEqual(mismatch.state.open, [0, 1])
  assert.equal(flipCard(mismatch.state, 2).state, mismatch.state)
})

test('discount game compares percentages rather than absolute savings', () => {
  assert.equal(discountPercent(100, 50), 50)
  assert.equal(discountPercent(400, 320), 20)
  assert.ok(discountPercent(100, 50) > discountPercent(400, 320))
})

test('shuffle preserves every pair without mutating the source', () => {
  const cards = [0, 0, 1, 1, 2, 2, 3, 3]
  assert.deepEqual(shuffled(cards).sort(), cards)
  assert.deepEqual(cards, [0, 0, 1, 1, 2, 2, 3, 3])
})
