/**
 * 오늘의 미션 카드를 완료했을 때, 그 카드가 있던 화면 위치에서 색종이가 터지는 효과입니다.
 *
 * 비개발자 설명: 아이가 카드를 누른 그 자리를 기준으로 화면에 컨페티가 흩뿌려져,
 * “잘했어요” 느낌을 전달합니다. 별도 팝업 없이도 축하가 느껴지게 하려는 용도입니다.
 */

/** canvas-confetti 옵션 객체 — 타입은 라이브러리 기본 호출과 맞춥니다 */
type ConfettiCall = (opts?: import('canvas-confetti').Options) => Promise<undefined> | null

/** 카드(버튼)의 getBoundingClientRect() 결과 — 중심 좌표로 변환해 컨페티 시작점을 잡습니다 */
export function fireMissionCardConfetti(cardRect: DOMRect): void {
  if (typeof window === 'undefined') return
  const w = window.innerWidth
  const h = window.innerHeight
  if (w <= 0 || h <= 0) return

  // canvas-confetti: origin 은 0~1 (화면 왼위가 0,0 / 오른아래가 1,1)
  const ox = (cardRect.left + cardRect.width / 2) / w
  const oy = (cardRect.top + cardRect.height / 2) / h

  void import('canvas-confetti').then((mod) => {
    const confetti = mod.default as ConfettiCall
    confetti({
      particleCount: 90,
      spread: 78,
      startVelocity: 32,
      scalar: 0.95,
      ticks: 200,
      origin: { x: ox, y: oy },
    })
    window.setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 60,
        startVelocity: 22,
        scalar: 0.95,
        origin: { x: ox, y: Math.min(1, oy + 0.03) },
        ticks: 150,
      })
    }, 90)
  })
}
