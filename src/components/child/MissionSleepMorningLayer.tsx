'use client'

/**
 * 미션 탭 전용: 「오늘 미션을 모두 완료했을 때」 연출 + 「아침 기상」 알람 팝업
 *
 * - 전체 완료: 컨페티가 떨어지다가 엄지 따봉이 나올 때까지 같은 컨페티를 유지하고, 따봉은 조금 더 오래 보인 뒤 사라짐 (박수 연출 없음)
 * - 그다음 수면 모드 안내(잘 자요, 화면 중앙 팝업) — `mode.png` 아틀라스의 sleep 영역 사용 (`mode.json` 과 같은 폴더)
 * - 아침: 서울 시각이 기상 알람 시각 이후이고, 부모(또는 온보딩)에서 저장한 루틴 알람 설정이 있으면
 *   해 이미지가 아래에서 슬라이드되며 팝업 + 선택된 알람 소리 재생, 「알람 끄기」로 정지
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSeoulDateString, getSeoulTimeHHMM, getSeoulWeekdayShort } from '@/lib/koreaDate'
import { readRoutineAlarmPrefs } from '@/lib/routineAlarmLocalPrefs'

/** TexturePacker `mode.json` 과 맞춘 아틀라스 크기·프레임 (이미지 파일: `public/assets/img/common/ui/mode.png`) */
const MODE_ATLAS = {
  url: '/assets/img/common/ui/mode.png',
  w: 376,
  h: 175,
  morning: { x: 3, y: 3, w: 234, h: 169 },
  sleep: { x: 241, y: 3, w: 132, h: 139 },
} as const

/** 컨페티 조각 파일명 — 폴더에 없으면 해당 이미지만 숨김(onError) */
const CONFETTI_FILENAMES = [
  'confetti (1).png',
  'confetti (2).png',
  'confetti (3).png',
  'confetti (4).png',
  'confetti (5).png',
  'confetti (6).png',
  'confetti (7).png',
  'confetti (8).png',
  'confetti (9).png',
]

const THUMBS_SRC = '/assets/img/games/confetti/thumsup.png'

/**
 * 전체 완료 축하 타이밍 (밀리초)
 * - 따봉이 뜨기 전: 컨페티만
 * - 따봉 구간: 컨페티는 그대로 두고 가운데에 따봉을 겹쳐 보여 줌
 */
const CELEBRATION_CONFETTI_SOLO_MS = 2000
const CELEBRATION_THUMB_VISIBLE_MS = 3400

type CelebrationStep = 'idle' | 'confetti' | 'thumb'

type Props = {
  childId: string
  /** 서버에서 넘긴 서울 기준 오늘 날짜 (저장 키에 사용) */
  today: string
  /** 휴식일이면 아침 알람·완료 연출 모두 쉼 */
  isFullRestDay: boolean
  completedCount: number
  totalMissions: number
}

function confettiUrl(filename: string): string {
  return `/assets/img/games/confetti/${encodeURIComponent(filename)}`
}

/** 아틀라스 한 조각을 잘라 보이게 하는 div (비개발자용: 큰 도장 이미지에서 필요한 부분만 보여 줌) */
function ModeAtlasSprite({
  frame,
  className,
  scale = 1,
  alt,
}: {
  frame: 'morning' | 'sleep'
  className?: string
  scale?: number
  alt: string
}) {
  const f = frame === 'morning' ? MODE_ATLAS.morning : MODE_ATLAS.sleep
  return (
    <div
      role="img"
      aria-label={alt}
      className={className}
      style={{
        width: f.w * scale,
        height: f.h * scale,
        backgroundImage: `url(${MODE_ATLAS.url})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${MODE_ATLAS.w * scale}px ${MODE_ATLAS.h * scale}px`,
        backgroundPosition: `${-f.x * scale}px ${-f.y * scale}px`,
      }}
    />
  )
}

/** 화면에 뿌릴 가짜 컨페티 한 덩이 — 위치·지연·색은 무작위로 살짝씩 다르게 */
function ConfettiPiece({ src, delayMs }: { src: string; delayMs: number }) {
  /** 같은 카드 안에서 위치·회전이 매 프레임 바뀌지 않도록 첫 렌더 값만 씁니다 */
  const left = useMemo(() => `${6 + Math.random() * 88}%`, [])
  const rot = useMemo(() => `${Math.random() * 360}deg`, [])
  const dur = useMemo(() => 2.2 + Math.random() * 0.9, [])

  return (
    <img
      src={src}
      alt=""
      className="pointer-events-none absolute top-[-12%] w-[min(11vw,42px)] opacity-95 drop-shadow-sm"
      style={{
        left,
        transform: `rotate(${rot})`,
        animation: `mission-confetti-fall ${dur}s ease-in ${delayMs}ms forwards`,
      }}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden'
      }}
    />
  )
}

export default function MissionSleepMorningLayer({
  childId,
  today,
  isFullRestDay,
  completedCount,
  totalMissions,
}: Props) {
  const [celebrationStep, setCelebrationStep] = useState<CelebrationStep>('idle')
  const [sleepModalOpen, setSleepModalOpen] = useState(false)
  const [morningOpen, setMorningOpen] = useState(false)
  /** 컨페티 조각의 무작위 배치를 연출마다 새로 뽑기 위한 카운터 */
  const [confettiKey, setConfettiKey] = useState(0)

  const prevCompletedRef = useRef<number | null>(null)
  /**
   * @types/node 와 DOM 이 setTimeout 반환 타입을 다르게 잡아 충돌할 수 있어,
   * 브라우저에서는 숫자 id 로만 저장·해제합니다.
   */
  const celebrationTimersRef = useRef<number[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const clearCelebrationTimers = useCallback(() => {
    celebrationTimersRef.current.forEach((id) => window.clearTimeout(id))
    celebrationTimersRef.current = []
  }, [])

  /** 마지막 카드까지 완료하는 순간에만 연출 시작 (새로고침으로 이미 전부 완료인 첫 진입은 생략) */
  useEffect(() => {
    if (isFullRestDay || totalMissions <= 0) return

    const prev = prevCompletedRef.current
    prevCompletedRef.current = completedCount

    if (prev === null) return
    if (completedCount !== totalMissions || prev >= totalMissions) return

    clearCelebrationTimers()
    setConfettiKey((k) => k + 1)
    setCelebrationStep('confetti')

    const thumbAt = CELEBRATION_CONFETTI_SOLO_MS
    const endAt = thumbAt + CELEBRATION_THUMB_VISIBLE_MS

    celebrationTimersRef.current.push(
      window.setTimeout(() => setCelebrationStep('thumb'), thumbAt) as number,
      window.setTimeout(() => {
        setCelebrationStep('idle')
        setSleepModalOpen(true)
      }, endAt) as number,
    )

    return clearCelebrationTimers
  }, [completedCount, totalMissions, isFullRestDay, clearCelebrationTimers])

  /**
   * 아침: 서울 날짜가 페이지의 today 와 같고, 기상 시각을 지났으며, 알람이 켜져 있을 때 하루 1회
   * (휴식일에도 기상 알람은 울릴 수 있어 `isFullRestDay` 는 여기서 막지 않습니다)
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (getSeoulDateString() !== today) return

    const key = `cooanc_morning_alarm_popup_${childId}_${today}`
    if (localStorage.getItem(key)) return

    const prefs = readRoutineAlarmPrefs()
    if (!prefs.notifyWake || !prefs.soundWake.trim()) return

    const weekend = ['토', '일'].includes(getSeoulWeekdayShort(today))
    if (weekend && !prefs.wakeOnWeekend) return

    const nowHm = getSeoulTimeHHMM()
    if (nowHm < prefs.wakeTime) return

    /** 같은 날 두 번 뜨지 않도록 — 팝업을 연 직후 저장(탭 이동으로 effect가 여러 번 돌아도 1회) */
    localStorage.setItem(key, '1')

    const url = `/assets/audio/alarm/${encodeURIComponent(prefs.soundWake)}`
    const a = new Audio(url)
    a.loop = true
    audioRef.current = a
    void a.play().catch(() => {
      /* 자동 재생 차단 등 — 팝업만 표시 */
    })
    setMorningOpen(true)
  }, [childId, today])

  /** 탭을 나가도 알람 소리가 남지 않게 정리 */
  useEffect(() => {
    return () => {
      const a = audioRef.current
      if (a) {
        a.pause()
        audioRef.current = null
      }
    }
  }, [])

  const stopMorningAlarm = useCallback(() => {
    const a = audioRef.current
    if (a) {
      a.pause()
      a.currentTime = 0
      audioRef.current = null
    }
    setMorningOpen(false)
  }, [])

  const confettiPieces = useMemo(() => {
    const out: { key: string; src: string; delay: number }[] = []
    for (let i = 0; i < 18; i++) {
      const name = CONFETTI_FILENAMES[i % CONFETTI_FILENAMES.length]
      out.push({
        key: `${confettiKey}-${i}-${name}`,
        src: confettiUrl(name),
        delay: Math.floor(Math.random() * 500),
      })
    }
    return out
  }, [confettiKey])

  const showCelebrationOverlay = celebrationStep !== 'idle'

  return (
    <>
      {showCelebrationOverlay && (
        <div
          className="fixed inset-0 z-[105] flex flex-col items-center justify-center bg-black/45 p-6"
          role="presentation"
          aria-hidden
        >
          {/* 컨페티: 따봉 단계까지 계속 보임 (따봉과 동시에 겹쳐서 낙하 연출 유지) */}
          {(celebrationStep === 'confetti' || celebrationStep === 'thumb') && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {confettiPieces.map((p) => (
                <ConfettiPiece key={p.key} src={p.src} delayMs={p.delay} />
              ))}
            </div>
          )}

          {celebrationStep === 'thumb' && (
            <img
              src={THUMBS_SRC}
              alt="최고"
              className="relative z-[1] max-h-[min(40dvh,220px)] w-auto animate-bounce drop-shadow-xl"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
        </div>
      )}

      {/* 수면 안내 팝업: 하단 탭(독) 높이만큼 아래 여백을 두고, 그 안에서 세로 중앙 정렬 */}
      {sleepModalOpen && (
        <div
          className="fixed inset-0 z-[106] flex items-center justify-center px-4 pt-4 pb-[max(1rem,calc(env(safe-area-inset-bottom)+5rem))] sm:px-6 sm:pt-6 sm:pb-[max(1rem,calc(env(safe-area-inset-bottom)+5rem))]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sleep-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="배경 닫기"
            onClick={() => setSleepModalOpen(false)}
          />
          <div
            className="relative z-[1] w-full max-w-sm"
            style={{ animation: 'mission-sheet-slide-up 0.45s ease-out forwards' }}
          >
            <div className="mx-auto rounded-3xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50 to-white p-6 shadow-2xl">
              <div className="flex flex-col items-center gap-4">
                <ModeAtlasSprite frame="sleep" scale={1.15} alt="수면 모드" className="shrink-0" />
                <div className="text-center">
                  <p id="sleep-modal-title" className="text-lg font-black text-indigo-950">
                    수면 모드 · 잘 자요
                  </p>
                  {/* 본문: 첫 줄·둘째 줄을 나눠 읽기 쉽게 표시 */}
                  <p className="mt-2 text-sm font-bold leading-relaxed text-indigo-900/80">
                    모든 미션을 마쳤어요
                    <br />
                    푹쉬고 내일 또 만나요!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSleepModalOpen(false)}
                  className="w-full rounded-2xl bg-brand-blue py-3 text-sm font-black text-white shadow-md active:scale-[0.99]"
                >
                  확인했어요
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 아침 알람: 하단 시트가 아니라 화면 중앙에 두어 하단 독(탭바)에 가리지 않게 함 */}
      {morningOpen && (
        <div
          className="fixed inset-0 z-[107] flex items-center justify-center px-4 pt-4 pb-[max(1rem,calc(env(safe-area-inset-bottom)+5.5rem))] sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="morning-modal-title"
        >
          <button type="button" className="absolute inset-0 bg-black/45" aria-label="배경" onClick={stopMorningAlarm} />
          <div
            className="relative z-[1] w-full max-w-md max-h-[min(90dvh,640px)] overflow-y-auto overflow-x-hidden rounded-3xl border-2 border-amber-200 bg-gradient-to-b from-amber-50 via-white to-white shadow-2xl"
            style={{ animation: 'mission-sheet-slide-up 0.5s ease-out forwards' }}
          >
            <div
              className="flex justify-center pt-6"
              style={{ animation: 'mission-sun-slide-up 0.55s ease-out forwards' }}
            >
              <ModeAtlasSprite frame="morning" scale={1.1} alt="아침 해" className="shrink-0" />
            </div>
            <div className="px-6 pb-6 pt-2">
              <p id="morning-modal-title" className="text-center text-xl font-black text-amber-950">
                좋은 아침이에요!
              </p>

              {/* 노란 블록: 기상 시각(HH:MM)만 크게 — 라벨·소리·안내 문구는 제거 */}
              <div className="mt-4 flex min-h-[5.5rem] items-center justify-center rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-6">
                <p className="text-center text-4xl font-black tabular-nums tracking-tight text-amber-800 sm:text-5xl">
                  {readRoutineAlarmPrefs().wakeTime}
                </p>
              </div>

              <button
                type="button"
                onClick={stopMorningAlarm}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-sm font-black text-white shadow-lg active:scale-[0.99]"
              >
                알람 끄기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
