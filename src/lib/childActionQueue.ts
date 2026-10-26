'use client'

type QueueState = { tail: Promise<unknown>; sequence: number }
const queues = new Map<string, QueueState>()

/** Reserve at the tap, including a piggy batch that has not been sent yet. */
export function queueChildAction<T>(childId: string, action: () => Promise<T>): Promise<T> {
  const state = queues.get(childId) ?? { tail: Promise.resolve(), sequence: 0 }
  const result = state.tail.then(action).then((value) => {
    if (typeof window !== 'undefined' && state.tail === result) {
      window.dispatchEvent(new CustomEvent('cooanc:child-actions-idle', { detail: { childId, sequence: state.sequence } }))
    }
    return value
  }, (error) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cooanc:child-action-failed', { detail: { childId } }))
    throw error
  })
  state.sequence += 1
  state.tail = result
  queues.set(childId, state)
  // Keep a failed, uncertain action as a barrier until the screen is reloaded.
  void result.catch(() => {})
  return result
}

export function childActionSequence(childId: string): number {
  return queues.get(childId)?.sequence ?? 0
}

/** Only use for requests carrying a persistent server-side receipt ID. */
export async function fetchReceiptedAction(url: string, body: Record<string, unknown>): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify(body),
      })
      if (response.status < 500) return response
      lastError = new Error('저장 결과를 확인하지 못했어요. 화면을 새로고침해 주세요.')
    } catch (error) { lastError = error }
  }
  throw lastError
}
