import test from 'node:test'
import assert from 'node:assert/strict'
import { newSnake, turnSnake, stepSnake, spawnFood } from './snake-game.ts'
const playing = (extra = {}) => ({ ...newSnake(), status: 'playing', ...extra })

test('snake moves automatically and keeps its length without food', () => {
  const initial = playing()
  const result = stepSnake(initial)
  assert.deepEqual(result.state.body, [45, 44, 43])
  assert.equal(result.points, 0)
  assert.deepEqual(initial.body, [44, 43, 42])
})
test('food grows the snake and gives points only once', () => {
  const result = stepSnake(playing({ food: 45 }), () => 0)
  assert.equal(result.points, 10)
  assert.equal(result.state.body.length, 4)
  assert.ok(!result.state.body.includes(result.state.food))
  assert.equal(stepSnake(result.state).points, 0)
})
test('opposite turns and two turns within a tick cannot reverse the snake', () => {
  const state = playing()
  assert.equal(turnSnake(state, 'ArrowLeft'), state)
  const queued = turnSnake(state, 'ArrowUp')
  assert.equal(turnSnake(queued, 'ArrowLeft'), queued)
  assert.equal(stepSnake(queued).state.body[0], 34)
})
test('all four walls end the round without scoring', () => {
  for (const [head, direction] of [[0, 'ArrowUp'], [90, 'ArrowDown'], [40, 'ArrowLeft'], [49, 'ArrowRight']]) {
    const result = stepSnake(playing({ body: [head], direction, queued: direction }))
    assert.equal(result.state.status, 'over')
    assert.equal(result.points, 0)
  }
})
test('body collisions end the round but moving into the vacating tail is valid', () => {
  const state = playing({ body: [44, 45, 55, 54], direction: 'ArrowUp', queued: 'ArrowRight' })
  assert.equal(stepSnake(state).state.status, 'over')
  assert.equal(stepSnake({ ...state, queued: 'ArrowDown' }).state.status, 'playing')
})
test('ready, paused, over and won states never move or score', () => {
  for (const status of ['ready', 'paused', 'over', 'won']) {
    const state = { ...newSnake(), status }
    assert.equal(stepSnake(state).state, state)
    assert.equal(stepSnake(state).points, 0)
  }
})
test('filling the board wins without spawning food on the snake', () => {
  const body = Array.from({ length: 100 }, (_, i) => i).filter(i => i !== 45)
  body.splice(body.indexOf(44), 1)
  body.unshift(44)
  const result = stepSnake(playing({ body, food: 45 }))
  assert.equal(result.state.status, 'won')
  assert.equal(result.state.food, null)
  assert.equal(result.points, 10)
  assert.equal(spawnFood(Array.from({ length: 100 }, (_, i) => i)), null)
})
