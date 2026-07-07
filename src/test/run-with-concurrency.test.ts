import { describe, expect, it } from 'vitest'
import { runWithConcurrency } from '@/obp/common-functions'

describe('runWithConcurrency', () => {
  it('never runs more than the given limit of tasks at once', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    let inFlight = 0
    let maxInFlight = 0

    await runWithConcurrency(items, 3, async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight--
    })

    expect(maxInFlight).toBeLessThanOrEqual(3)
  })

  it('processes every item exactly once', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    const seen: number[] = []

    await runWithConcurrency(items, 3, async (item) => {
      seen.push(item)
    })

    expect(seen.sort((a, b) => a - b)).toEqual(items)
  })

  it('lets one failing task run without stopping the others', async () => {
    const items = [1, 2, 3, 4, 5]
    const processed: number[] = []

    await expect(
      runWithConcurrency(items, 2, async (item) => {
        if (item === 3) {
          throw new Error('boom')
        }
        processed.push(item)
      })
    ).rejects.toThrow('boom')

    expect(processed.length).toBeGreaterThan(0)
  })

  it('attempts every item even when some fail, only rejecting after all settle', async () => {
    const items = [1, 2, 3, 4, 5, 6]
    const processed: number[] = []

    await expect(
      runWithConcurrency(items, 3, async (item) => {
        if (item % 2 === 0) {
          throw new Error(`boom-${item}`)
        }
        processed.push(item)
      })
    ).rejects.toThrow(/boom-/)

    // Every odd item still ran despite the even items throwing.
    expect(processed.sort((a, b) => a - b)).toEqual([1, 3, 5])
  })

  it('re-throws only after all items have settled, not as soon as the first fails', async () => {
    const order: string[] = []

    await expect(
      runWithConcurrency([1, 2], 2, async (item) => {
        order.push(`start-${item}`)
        // item 1 is slower than item 2, so item 2 settles (and throws) first.
        await new Promise((resolve) => setTimeout(resolve, item === 1 ? 5 : 1))
        order.push(`end-${item}`)
        throw new Error(`boom-${item}`)
      })
    ).rejects.toThrow('boom-2')

    // Both tasks fully ran (start and end) before the pool rejected — the slower
    // item 1 was not abandoned mid-flight when item 2 threw first.
    expect(order).toEqual(['start-1', 'start-2', 'end-2', 'end-1'])
  })
})
