'use client'

import { useRef, useCallback, useEffect } from 'react'

// ─── BGM singleton ──────────────────────────────────────────────────────────
// BGM은 전역에서 하나만 재생됩니다. 새 BGM 재생 시 기존 것을 자동으로 정지합니다.
let _bgmAudio: HTMLAudioElement | null = null
let _bgmSrc: string | null = null

function stopGlobalBgm() {
  if (_bgmAudio) {
    _bgmAudio.pause()
    _bgmAudio.currentTime = 0
    _bgmAudio = null
    _bgmSrc = null
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type AudioMode = 'sfx' | 'bgm'

export interface AudioOptions {
  /**
   * 'sfx' (기본값): 효과음 모드. 훅 인스턴스마다 독립 Audio 객체를 생성해
   *               여러 소리가 동시에 중첩 재생됩니다.
   * 'bgm':         배경음악 모드. 전역 싱글톤으로 관리되며 새 BGM 재생 시
   *               이전 BGM이 자동 정지됩니다.
   */
  mode?: AudioMode
  /** 초기 볼륨 (0–1). 기본값: 1 */
  volume?: number
  /** 루프 재생 여부. 기본값: false */
  loop?: boolean
  /** 재생 종료 시 호출되는 콜백 */
  onEnded?: () => void
}

export interface AudioControls {
  /** 오디오를 재생합니다. 옵션을 덮어쓸 수 있습니다. */
  play: (overrides?: Partial<AudioOptions>) => void
  /** 현재 위치에서 일시정지합니다. */
  pause: () => void
  /** 정지하고 처음으로 되돌립니다. */
  stop: () => void
  /** 볼륨을 변경합니다 (0–1). */
  setVolume: (v: number) => void
  /** 루프 재생 여부를 변경합니다. */
  setLoop: (l: boolean) => void
  /** 현재 재생 중인지 여부. */
  isPlaying: () => boolean
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * 오디오 파일 하나를 제어하는 훅.
 *
 * @example
 * // 효과음 (SFX) — 중첩 재생
 * const sfx = useAudio(AUDIO.EFFECTS.LEVEL_UP, { volume: 0.8 })
 * sfx.play()
 *
 * @example
 * // 배경음악 (BGM) — 싱글톤
 * const bgm = useAudio(AUDIO.ALARM.MORNING_ALARM_BIRDS, { mode: 'bgm', loop: true, volume: 0.4 })
 * bgm.play()
 *
 * @example
 * // 재생 완료 콜백
 * const sfx = useAudio(AUDIO.MISSIONS.SUCCESS_REWARD, { onEnded: () => setDone(true) })
 * sfx.play()
 */
export function useAudio(src: string, defaultOptions: AudioOptions = {}): AudioControls {
  const optsRef = useRef<Required<AudioOptions>>({
    mode: defaultOptions.mode ?? 'sfx',
    volume: defaultOptions.volume ?? 1,
    loop: defaultOptions.loop ?? false,
    onEnded: defaultOptions.onEnded ?? (() => {}),
  })

  // SFX 모드: 훅 인스턴스가 소유하는 Audio 객체
  const sfxRef = useRef<HTMLAudioElement | null>(null)

  // defaultOptions가 바뀌면 optsRef 업데이트
  useEffect(() => {
    optsRef.current = {
      mode:    defaultOptions.mode    ?? 'sfx',
      volume:  defaultOptions.volume  ?? 1,
      loop:    defaultOptions.loop    ?? false,
      onEnded: defaultOptions.onEnded ?? (() => {}),
    }
  })

  // 언마운트 시 SFX 인스턴스 정리
  useEffect(() => {
    return () => {
      if (sfxRef.current) {
        sfxRef.current.pause()
        sfxRef.current = null
      }
    }
  }, [])

  // ─── helpers ─────────────────────────────────────────────────────────────

  function getOrCreateAudio(opts: Required<AudioOptions>): HTMLAudioElement {
    if (opts.mode === 'bgm') {
      if (_bgmAudio && _bgmSrc === src) {
        return _bgmAudio
      }
      // 다른 BGM이 재생 중이면 정지
      stopGlobalBgm()
      const audio = new Audio(src)
      _bgmAudio = audio
      _bgmSrc = src
      return audio
    }

    // SFX 모드: 기존 인스턴스 재사용 (동일 src)
    if (!sfxRef.current || sfxRef.current.src !== buildAbsSrc(src)) {
      if (sfxRef.current) {
        sfxRef.current.pause()
      }
      sfxRef.current = new Audio(src)
    }
    return sfxRef.current
  }

  function applyOptions(audio: HTMLAudioElement, opts: Required<AudioOptions>) {
    audio.volume = Math.max(0, Math.min(1, opts.volume))
    audio.loop   = opts.loop
    audio.onended = opts.loop ? null : () => opts.onEnded()
  }

  // ─── controls ────────────────────────────────────────────────────────────

  const play = useCallback((overrides: Partial<AudioOptions> = {}) => {
    const opts: Required<AudioOptions> = {
      ...optsRef.current,
      ...Object.fromEntries(
        Object.entries(overrides).filter(([, v]) => v !== undefined)
      ) as Partial<AudioOptions>,
      onEnded: overrides.onEnded ?? optsRef.current.onEnded,
    }

    const audio = getOrCreateAudio(opts)
    applyOptions(audio, opts)

    // 처음부터 재생하기 위해 currentTime 리셋 (일시정지 상태이면 이어서 재생)
    if (audio.paused && audio.currentTime > 0) {
      // 이미 일시정지된 경우 이어서 재생
    } else if (!audio.paused) {
      // 이미 재생 중이면 처음부터
      audio.currentTime = 0
    }

    audio.play().catch((err) => {
      // 브라우저 autoplay 정책 등 무시
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[useAudio] play() failed:', err)
      }
    })
  }, [src]) // eslint-disable-line react-hooks/exhaustive-deps

  const pause = useCallback(() => {
    const target = optsRef.current.mode === 'bgm' ? _bgmAudio : sfxRef.current
    target?.pause()
  }, [])

  const stop = useCallback(() => {
    if (optsRef.current.mode === 'bgm') {
      if (_bgmSrc === src) stopGlobalBgm()
    } else {
      if (sfxRef.current) {
        sfxRef.current.pause()
        sfxRef.current.currentTime = 0
      }
    }
  }, [src])

  const setVolume = useCallback((v: number) => {
    optsRef.current.volume = Math.max(0, Math.min(1, v))
    const target = optsRef.current.mode === 'bgm' ? _bgmAudio : sfxRef.current
    if (target) target.volume = optsRef.current.volume
  }, [])

  const setLoop = useCallback((l: boolean) => {
    optsRef.current.loop = l
    const target = optsRef.current.mode === 'bgm' ? _bgmAudio : sfxRef.current
    if (target) target.loop = l
  }, [])

  const isPlaying = useCallback((): boolean => {
    const target = optsRef.current.mode === 'bgm' ? _bgmAudio : sfxRef.current
    return !!target && !target.paused && !target.ended
  }, [])

  return { play, pause, stop, setVolume, setLoop, isPlaying }
}

// ─── BGM helpers (전역) ──────────────────────────────────────────────────────

/** 현재 재생 중인 BGM을 즉시 정지합니다. 컴포넌트 바깥에서도 호출 가능. */
export { stopGlobalBgm as stopBgm }

/** 현재 BGM 소스 경로를 반환합니다. */
export function currentBgmSrc(): string | null {
  return _bgmSrc
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function buildAbsSrc(src: string): string {
  if (typeof window === 'undefined') return src
  return new URL(src, window.location.href).href
}
