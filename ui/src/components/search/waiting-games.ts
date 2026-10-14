export const GRID_SIZE = 4

export function movePlayer(position: number, direction: string): number {
  const row = Math.floor(position / GRID_SIZE)
  const col = position % GRID_SIZE
  if (direction === 'ArrowUp' && row > 0) return position - GRID_SIZE
  if (direction === 'ArrowDown' && row < GRID_SIZE - 1) return position + GRID_SIZE
  if (direction === 'ArrowLeft' && col > 0) return position - 1
  if (direction === 'ArrowRight' && col < GRID_SIZE - 1) return position + 1
  return position
}

export function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function nextCoin(player: number): number {
  return shuffled(Array.from({ length: 16 }, (_, i) => i).filter(i => i !== player))[0]
}

export function discountPercent(original: number, price: number): number {
  return Math.round((original - price) / original * 100)
}

export type MemoryState = { cards: number[]; open: number[]; matched: number[] }
export function flipCard(state: MemoryState, index: number): { state: MemoryState; points: number } {
  if (index < 0 || index >= state.cards.length || state.open.length === 2 || state.open.includes(index) || state.matched.includes(index)) return { state, points: 0 }
  const open = [...state.open, index]
  if (open.length === 2 && state.cards[open[0]] === state.cards[open[1]]) {
    return { state: { ...state, open: [], matched: [...state.matched, ...open] }, points: 20 }
  }
  return { state: { ...state, open }, points: 0 }
}
