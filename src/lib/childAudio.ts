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
  /** 실제 레포에 존재하는 파일로 고정(기존 tick-tock 경로는 파일 부재로 404). */
  tickTock: '/assets/audio/alerts/잘시간.mp3',
  /** 뽀모도로 타이머 — 남은 시간 10초가 되는 순간부터 재생하는 틱톡 경고음 */
  pomodoroTenSecond: '/assets/audio/countdown/tick-tock-timer.wav',
  /** 뽀모도로 타이머 — 00:00 도달 시 재생(정지 버튼으로 끔) */
  pomodoroEnd: '/assets/audio/effects/뽀모도로 타이머 끝.mp3',
  /** 미션 카드 탭 즉시 반응음 — 요청 경로의 성공 효과음으로 고정 */
  cardTap: '/assets/audio/missions/success_reward-fairy-arcade-sparkle-866.wav',
  /** 연속 탭 확인 팝업 등 보조 효과음 */
  popupAlert: '/assets/audio/alerts/잘시간.mp3',
  /** 마켓 계산대(크레딧 차감) 연출 */
  marketCheckout: '/assets/audio/effects/floraphonic-coin-donation-6-183893.mp3',
  /** 마켓 구매 완료(낙하산·콘페티) 축하 */
  marketPurchaseCheer: '/assets/audio/effects/환호성.mp3',
} as const

export type PlayAudioTimedFadeOutOptions = {
  /** 페이드아웃 전 풀 볼륨으로 재생할 시간(ms) */
  playMs?: number
  /** 볼륨을 0까지 줄이는 시간(ms) */
  fadeMs?: number
  /** 시작 볼륨 0~1 */
  volume?: number
}

/**
 * 지정 시간만큼 재생한 뒤 볼륨을 서서히 줄여 끝냅니다.
 * 반환 함수를 호출하면 타이머·페이드·재생을 즉시 중단합니다.
 */
export function playAudioWithTimedFadeOut(
  src: string,
  opts: PlayAudioTimedFadeOutOptions = {},
): () => void {
  if (typeof window === 'undefined') return () => {}

  const { playMs = 2000, fadeMs = 500, volume = 1 } = opts
  const audio = createPreloadedAudio(src)
  audio.volume = volume

  let cancelled = false
  /** 브라우저 `setTimeout` id — Node `Timeout` 과 구분 */
  let fadeStartTimer: number | null = null
  let rafId: number | null = null

  const stopPlayback = () => {
    try {
      audio.pause()
      audio.currentTime = 0
    } catch {
      /* ignore */
    }
  }

  void audio.play().catch((e) => console.warn('[childAudio] timed fade play failed', e))

  fadeStartTimer = window.setTimeout(() => {
    if (cancelled) return
    const startVol = audio.volume
    const fadeStart = performance.now()

    const step = (now: number) => {
      if (cancelled) return
      const t = Math.min(1, (now - fadeStart) / fadeMs)
      audio.volume = Math.max(0, startVol * (1 - t))
      if (t < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        stopPlayback()
      }
    }
    rafId = requestAnimationFrame(step)
  }, playMs)

  return () => {
    cancelled = true
    if (fadeStartTimer !== null) window.clearTimeout(fadeStartTimer)
    if (rafId !== null) cancelAnimationFrame(rafId)
    stopPlayback()
  }
}

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
  const audio = createPreloadedAudio(src)
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
  const audio = createPreloadedAudio(src)
  audio.volume = volume
  void audio.play().catch((e) => console.warn('[childAudio] play failed', e))
  return audio
}

/**
 * `playAudio` 의 비동기 버전 — 실패하면 `false` (UI에서 「소리 켜기」 유도 가능).
 */
export async function tryPlayAudioOnce(src: string, volume = 1.0): Promise<boolean> {
  try {
    const audio = createPreloadedAudio(src)
    audio.volume = volume
    await audio.play()
    return true
  } catch (e) {
    console.warn('[childAudio] tryPlayAudioOnce failed', e)
    return false
  }
}

/**
 * 재생 전에 `preload='auto'`를 지정해 파일 준비 시간을 줄입니다.
 * 비개발자: 소리를 누르자마자 더 빨리 나오게 돕는 공통 생성기입니다.
 */
export function createPreloadedAudio(src: string): HTMLAudioElement {
  const audio = new Audio(src)
  audio.preload = 'auto'
  return audio
}
