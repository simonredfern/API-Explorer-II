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
})
