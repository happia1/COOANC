/**
 * 자녀 앱 공통 효과음 경로 + 재생 헬퍼
 *
 * 비개발자 설명: 미션 완료·수면 모드·아침 화면 등에서 같은 방식으로 소리를 냅니다.
 * 파일은 `public/assets/audio/alerts/` 아래에 두고, 여기서는 웹 주소만 모아 둡니다.
 *
 * 루틴 「알람」만 특별해요:
 * - 크롬·사파리는 **화면을 눌렀을 때**(사용자 제스처)가 아니면 스피커 소리 재생을 막는 규칙이 있습니다.
 * - 그래서 앱 안에서 **처음 한 번** 손으로 화면을 짚을 때 귀에 거의 안 들리게 짧게 재생을 시도해서,
 *   브라우저가 「이 페이지는 소리 써도 된다」고 열어 두게 합니다.
 * - 그래도 막히면 알람 창에서 「소리 켜기」 버튼을 누르도록 안내합니다(버튼 누름 = 제스처).
 */

export const CHILD_AUDIO = {
  sleepReady: '/assets/audio/alerts/잘 준비.wav',
  goodMorning: '/assets/audio/alerts/기분좋게 시작.wav',
  morningGreet: '/assets/audio/alerts/아침인사.wav',
  timeToGo: '/assets/audio/alerts/이제 나갈시간이야.wav',
  dontLie: '/assets/audio/alerts/거짓말은 나 속상해.wav',
  /** 뽀모도로 등 추후용 — 파일 추가 전까지 재생 실패 시 콘솔만 경고 */
  tickTock: '/assets/audio/alerts/tick-tock-timer.wav',
  /** 연속 탭 확인 팝업 등 — 짧은 보조 효과음(`public/assets/audio/alerts/no.wav`) */
  popupAlert: '/assets/audio/alerts/no.wav',
} as const

/** `installChildRoutineAudioUnlockOnFirstGesture` 가 전역 리스너를 중복해서 붙지 않게 합니다 */
let routineAudioGestureUnlockInstalled = false

/**
 * 사용자가 태블릿·폰 화면을 처음 눌렀을 때 한 번만 실행됩니다.
 * 무음에 가깝게 짧게 재생을 시도해 이후 브라우저 정책으로 막히는 알람 재생 확률을 줄입니다.
 */
export function installChildRoutineAudioUnlockOnFirstGesture(): void {
  if (typeof window === 'undefined' || routineAudioGestureUnlockInstalled) return
  routineAudioGestureUnlockInstalled = true

  const tryUnlock = () => {
    /** 짧은 음원 — 완전 무음 플레이는 일부 기기에서 잠금이 안 되어 아주 작은 볼륨만 씁니다 */
    const a = new Audio(CHILD_AUDIO.tickTock)
    a.muted = true
    a.volume = 0
    void a.play().then(
      () => {
        try {
          a.pause()
          a.currentTime = 0
        } catch {
          /* ignore */
        }
      },
      () => {
        /** 무음 차단 환경: 아주 미세하게 들리는 레벨로 한 번 더 시도 */
        try {
          a.muted = false
          a.volume = 0.02
          void a.play().then(
            () => {
              try {
                a.pause()
                a.currentTime = 0
              } catch {
                /* ignore */
              }
            },
            () => {},
          )
        } catch {
          /* ignore */
        }
      },
    )
  }

  const onFirstInteract = () => {
    tryUnlock()
    window.removeEventListener('pointerdown', onFirstInteract, true)
    window.removeEventListener('touchstart', onFirstInteract, true)
  }

  window.addEventListener('pointerdown', onFirstInteract, { capture: true, passive: true })
  window.addEventListener('touchstart', onFirstInteract, { capture: true, passive: true })
}

/**
 * 미션 레이어 루틴 알람처럼 **반복 재생이 필요할 때** 씁니다.
 * 브라우저가 재생을 거절하면 `null`(팝업에 「소리 켜기」 안내 필요).
 */
export async function playRoutineAlarmLooped(
  src: string,
  volume = 1,
): Promise<HTMLAudioElement | null> {
  const audio = new Audio(src)
  audio.loop = true
  audio.volume = volume
  try {
    await audio.play()
    return audio
  } catch (e) {
    console.warn('[childAudio] looped alarm blocked by autoplay policy or load error', e)
    return null
  }
}

export function playAudio(src: string, volume = 1.0): HTMLAudioElement {
  const audio = new Audio(src)
  audio.volume = volume
  void audio.play().catch((e) => console.warn('[childAudio] play failed', e))
  return audio
}

/**
 * `playAudio` 의 비동기 버전 — 실패하면 `false` (UI에서 「소리 켜기」 유도 가능).
 */
export async function tryPlayAudioOnce(src: string, volume = 1.0): Promise<boolean> {
  try {
    const audio = new Audio(src)
    audio.volume = volume
    await audio.play()
    return true
  } catch (e) {
    console.warn('[childAudio] tryPlayAudioOnce failed', e)
    return false
  }
}
