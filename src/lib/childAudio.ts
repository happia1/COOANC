/**
 * 자녀 앱 공통 효과음 경로 + 재생 헬퍼
 *
 * 비개발자 설명: 미션 완료·수면 모드·아침 화면 등에서 같은 방식으로 소리를 냅니다.
 * 파일은 `public/assets/audio/alerts/` 아래에 두고, 여기서는 웹 주소만 모아 둡니다.
 */

export const CHILD_AUDIO = {
  sleepReady: '/assets/audio/alerts/잘 준비.wav',
  goodMorning: '/assets/audio/alerts/기분좋게 시작.wav',
  morningGreet: '/assets/audio/alerts/아침인사.wav',
  timeToGo: '/assets/audio/alerts/이제 나갈시간이야.wav',
  dontLie: '/assets/audio/alerts/거짓말은 나 속상해.wav',
  /** 뽀모도로 등 추후용 — 파일 추가 전까지 재생 실패 시 콘솔만 경고 */
  tickTock: '/assets/audio/alerts/tick-tock-timer.wav',
} as const

export function playAudio(src: string, volume = 1.0): HTMLAudioElement {
  const audio = new Audio(src)
  audio.volume = volume
  void audio.play().catch((e) => console.warn('[childAudio] play failed', e))
  return audio
}
