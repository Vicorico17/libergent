export const SNAKE_SIZE = 10
export type Direction = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
export type SnakeState = { body: number[]; food: number | null; direction: Direction; queued: Direction; status: 'ready' | 'playing' | 'paused' | 'over' | 'won' }
const opposite: Record<Direction, Direction> = { ArrowUp: 'ArrowDown', ArrowDown: 'ArrowUp', ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' }
export function spawnFood(body: number[], random = Math.random): number | null {
  const free = Array.from({ length: SNAKE_SIZE ** 2 }, (_, i) => i).filter(i => !body.includes(i))
  return free.length ? free[Math.floor(random() * free.length)] : null
}
export function newSnake(): SnakeState {
  return { body: [44, 43, 42], food: 47, direction: 'ArrowRight', queued: 'ArrowRight', status: 'ready' }
}
export function turnSnake(state: SnakeState, direction: Direction): SnakeState {
  if (state.status !== 'playing' || state.queued !== state.direction || direction === opposite[state.direction]) return state
  return { ...state, queued: direction }
}
export function stepSnake(state: SnakeState, random = Math.random): { state: SnakeState; points: number } {
  if (state.status !== 'playing') return { state, points: 0 }
  const head = state.body[0]
  const direction = state.queued
  const row = Math.floor(head / SNAKE_SIZE), col = head % SNAKE_SIZE
  const wall = (direction === 'ArrowUp' && row === 0) || (direction === 'ArrowDown' && row === SNAKE_SIZE - 1) || (direction === 'ArrowLeft' && col === 0) || (direction === 'ArrowRight' && col === SNAKE_SIZE - 1)
  const next = head + ({ ArrowUp: -SNAKE_SIZE, ArrowDown: SNAKE_SIZE, ArrowLeft: -1, ArrowRight: 1 }[direction])
  const eating = next === state.food
  const occupied = eating ? state.body : state.body.slice(0, -1)
  if (wall || occupied.includes(next)) return { state: { ...state, status: 'over' }, points: 0 }
  const body = [next, ...state.body]
  if (!eating) body.pop()
  const food = eating ? spawnFood(body, random) : state.food
  return { state: { body, food, direction, queued: direction, status: food === null ? 'won' : 'playing' }, points: eating ? 10 : 0 }
}
