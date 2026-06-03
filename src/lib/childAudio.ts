/**
 * 자녀 앱 공통 효과음 경로 + 재생 헬퍼
 *
 * 폴더 역할 (`public/assets/audio/`):
 * - `pomodoro/` — 뽀모도로 타이머 전용(영문 파일명, `?v=` 캐시 버스트)
 * - `alerts/` — 한글 음성 안내(기상·등원·잘 시간 등)
 * - `alarm/` — 기상 벨소리 WAV
 * - `countdown/` — (레거시) 예전 카운트다운·째깍 경로
 * - `effects/` · `missions/` — UI·보상 효과음
 *
 * 배포(Vercel)에서 소리가 안 바뀌면:
 * - `next.config.mjs` 가 `/assets/**` 에 1년 immutable 캐시를 줍니다.
 * - 같은 URL의 파일만 교체하면 CDN·브라우저가 예전 바이트를 재사용할 수 있어,
 *   `POMODORO_AUDIO_CACHE_BUST` 숫자를 올리거나 `pomodoro/` 아래 새 파일명을 씁니다.
 *
 * 루틴 「알람」 autoplay:
 * - 첫 화면 터치 때 무음에 가깝게 짧게 재생해 이후 알람 재생 허용을 노립니다.
 */

const AUDIO_BASE = '/assets/audio'

/**
 * 뽀모도로·루틴 「틱톡 타이머」 공통 캐시 버스트.
 * WAV/MP3 내용만 바꿨는데 배포에서 예전 소리가 나면 이 값을 1 올리세요.
 */
export const POMODORO_AUDIO_CACHE_BUST = '1'

/** 뽀모도로 10초 경고 + 루틴 알람 「틱톡 타이머」 */
const POMODORO_TEN_SECOND_TICK = `${AUDIO_BASE}/pomodoro/ten-second-tick.wav?v=${POMODORO_AUDIO_CACHE_BUST}`

/** 뽀모도로 00:00 종료 멜로디(정지 버튼으로 중단) */
const POMODORO_TIMER_END = `${AUDIO_BASE}/pomodoro/timer-end.mp3?v=${POMODORO_AUDIO_CACHE_BUST}`

export const CHILD_AUDIO = {
  sleepReady: `${AUDIO_BASE}/alerts/잘 준비.wav`,
  goodMorning: `${AUDIO_BASE}/alerts/기분좋게 시작.wav`,
  morningGreet: `${AUDIO_BASE}/alerts/아침인사.wav`,
  timeToGo: `${AUDIO_BASE}/alerts/이제 나갈시간이야.wav`,
  dontLie: `${AUDIO_BASE}/alerts/거짓말은 나 속상해.wav`,
  /** 루틴 알람 카탈로그 「틱톡 타이머」— 뽀모도로 10초 경고와 동일 */
  tickTock: POMODORO_TEN_SECOND_TICK,
  /** 뽀모도로 — 남은 10초 */
  pomodoroTenSecond: POMODORO_TEN_SECOND_TICK,
  /** 뽀모도로 — 타이머 종료 */
  pomodoroEnd: POMODORO_TIMER_END,
  /** 미션 카드 탭 즉시 반응음 — 요청 경로의 성공 효과음으로 고정 */
  cardTap: `${AUDIO_BASE}/missions/success_reward-fairy-arcade-sparkle-866.wav`,
  /** 연속 탭 확인 팝업 · 루틴 「잘 시간」 알람 */
  popupAlert: `${AUDIO_BASE}/alerts/잘시간.mp3`,
  /** 마켓 계산대(크레딧 차감) 연출 */
  marketCheckout: `${AUDIO_BASE}/effects/floraphonic-coin-donation-6-183893.mp3`,
  /** 마켓 구매 완료(낙하산·콘페티) 축하 */
  marketPurchaseCheer: `${AUDIO_BASE}/effects/환호성.mp3`,
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
