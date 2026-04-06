'use client'

/**
 * 자녀 프로필 등록 직후 설문 — 초기 미션 자동 세팅
 *
 * 흐름:
 *  Step 1. 연령대 (미취학 / 학령기)
 *  Step 2-A. 등원 여부 (미취학일 때만)
 *  Step 3. 기상 시간 (평일)
 *  Step 4. 취침 시간
 *  Step 5. 알람 설정 여부
 *  → 결과 기반 초기 미션 자동 생성 → onComplete() 호출
 */

import { useState } from 'react'

// ── 타입 ─────────────────────────────────────────────

type AgeGroup = 'preschool' | 'school'     // 미취학 / 학령기
type Daycare  = 'home'     | 'daycare'      // 가정보육 / 등원

interface SurveyState {
  ageGroup:  AgeGroup | null
  daycare:   Daycare  | null
  wakeTime:  string           // HH:MM
  bedTime:   string           // HH:MM
  setAlarm:  boolean | null
}

interface Props {
  childName: string
  onComplete: () => void   // 미션 생성 완료 후 호출
}

// ── 시간 유틸 ─────────────────────────────────────────

/** "HH:MM" + 분 → "HH:MM" */
function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total  = h * 60 + m + mins
  const hh     = String(Math.floor(total / 60) % 24).padStart(2, '0')
  const mm     = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

// ── 미션 템플릿 ─────────────────────────────────────────

type MissionTemplate = {
  title: string
  icon_emoji: string
  scheduled_time: string
  credit_reward: number
  exp_reward: number
  difficulty: 'easy' | 'normal' | 'hard' | 'special'
}

function buildMissions(s: SurveyState): MissionTemplate[] {
  const wake = s.wakeTime || '07:00'
  const bed  = s.bedTime  || '21:00'

  const base: MissionTemplate[] = [
    { title: '기상', icon_emoji: '', scheduled_time: wake, credit_reward: 5, exp_reward: 5, difficulty: 'easy' },
    { title: '세수하기', icon_emoji: '', scheduled_time: addMinutes(wake, 10), credit_reward: 5, exp_reward: 5, difficulty: 'easy' },
    { title: '아침 식사', icon_emoji: '', scheduled_time: addMinutes(wake, 20), credit_reward: 10, exp_reward: 10, difficulty: 'easy' },
  ]

  if (s.ageGroup === 'preschool') {
    if (s.daycare === 'home') {
      return [
        ...base,
        { title: '장난감 정리', icon_emoji: '', scheduled_time: '18:00', credit_reward: 10, exp_reward: 10, difficulty: 'easy' },
        { title: '취침 준비', icon_emoji: '', scheduled_time: bed, credit_reward: 5, exp_reward: 5, difficulty: 'easy' },
      ]
    } else {
      // 등원
      return [
        ...base,
        { title: '가방 챙기기', icon_emoji: '', scheduled_time: addMinutes(wake, 40), credit_reward: 10, exp_reward: 10, difficulty: 'easy' },
        { title: '귀가 후 손 씻기', icon_emoji: '', scheduled_time: '16:00', credit_reward: 10, exp_reward: 10, difficulty: 'easy' },
        { title: '취침 준비', icon_emoji: '', scheduled_time: bed, credit_reward: 5, exp_reward: 5, difficulty: 'easy' },
      ]
    }
  } else {
    // 학령기
    return [
      ...base,
      { title: '가방 챙기기', icon_emoji: '', scheduled_time: addMinutes(wake, 40), credit_reward: 10, exp_reward: 10, difficulty: 'easy' },
      { title: '숙제하기', icon_emoji: '', scheduled_time: '15:30', credit_reward: 20, exp_reward: 20, difficulty: 'normal' },
      { title: '취침 준비', icon_emoji: '', scheduled_time: bed, credit_reward: 5, exp_reward: 5, difficulty: 'easy' },
    ]
  }
}

// ── 메인 컴포넌트 ─────────────────────────────────────────

export default function ChildOnboardingSurvey({ childName, onComplete }: Props) {
  const [step, setStep]       = useState(1)
  const [creating, setCreating] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [survey, setSurvey] = useState<SurveyState>({
    ageGroup: null,
    daycare:  null,
    wakeTime: '07:00',
    bedTime:  '21:00',
    setAlarm: null,
  })

  // 연령대에 따라 Step 2 건너뜀
  function nextFromStep1(ageGroup: AgeGroup) {
    setSurvey(s => ({ ...s, ageGroup }))
    setStep(ageGroup === 'preschool' ? 2 : 3)
  }

  async function handleFinish(alarmChoice: boolean) {
    const finalSurvey = { ...survey, setAlarm: alarmChoice }
    setSurvey(finalSurvey)
    setCreating(true)
    setError(null)

    const missions = buildMissions(finalSurvey)

    try {
      // 순차 생성 (병렬 시 미션 순서 보장 어려움)
      for (const m of missions) {
        const res = await fetch('/api/mission/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:          m.title,
            icon_emoji:     m.icon_emoji,
            scheduled_time: m.scheduled_time,
            credit_reward:  m.credit_reward,
            exp_reward:     m.exp_reward,
            heart_reward:   0,
            difficulty:     m.difficulty,
            repeat_type:    'daily',
            level_required: 0,
            is_active:      true,
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? '미션 생성 실패')
        }
      }
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : '미션 생성 중 오류가 발생했어요.')
      setCreating(false)
    }
  }

  // ── 렌더 ─────────────────────────────────────────────

  if (creating) {
    return (
      <SurveyShell step={5} total={5}>
        <div className="flex flex-col items-center gap-4 py-8">
          <div
            className="h-12 w-12 animate-spin rounded-full border-2 border-brand-blue border-t-transparent"
            aria-hidden
          />
          <p className="font-bold text-brand-text">미션을 만들고 있어요…</p>
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 text-center">{error}</p>}
        </div>
      </SurveyShell>
    )
  }

  // Step 1 — 연령대
  if (step === 1) {
    return (
      <SurveyShell step={1} total={5} title="자녀 연령대를 알려주세요">
        <p className="text-sm text-gray-400 mb-6 text-center">{childName}에게 맞는 루틴을 추천해 드릴게요.</p>
        <div className="flex flex-col gap-3">
          <OptionButton label="미취학 아동" sub="7세 미만" onClick={() => nextFromStep1('preschool')} />
          <OptionButton label="학령기 아동" sub="초등학생 이상" onClick={() => nextFromStep1('school')} />
        </div>
      </SurveyShell>
    )
  }

  // Step 2 — 등원 여부 (미취학 only)
  if (step === 2) {
    return (
      <SurveyShell step={2} total={5} title="어린이집·유치원에 가나요?" onBack={() => setStep(1)}>
        <div className="flex flex-col gap-3 mt-4">
          <OptionButton
            label="가정 보육"
            sub="집에서 지내요"
            onClick={() => {
              setSurvey((s) => ({ ...s, daycare: 'home' }))
              setStep(3)
            }}
          />
          <OptionButton
            label="어린이집 / 유치원"
            sub="등원해요"
            onClick={() => {
              setSurvey((s) => ({ ...s, daycare: 'daycare' }))
              setStep(3)
            }}
          />
        </div>
      </SurveyShell>
    )
  }

  // Step 3 — 기상 시간
  if (step === 3) {
    return (
      <SurveyShell step={3} total={5} title="평일 기상 시간은?" onBack={() => setStep(survey.ageGroup === 'preschool' ? 2 : 1)}>
        <p className="text-sm text-gray-400 mb-5 text-center">미션 시간이 자동으로 배분돼요</p>
        <div className="flex flex-col items-center gap-4">
          <input
            type="time"
            value={survey.wakeTime}
            onChange={e => setSurvey(s => ({ ...s, wakeTime: e.target.value }))}
            className="text-3xl font-black text-brand-blue border-2 border-brand-blue/30 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
          />
          <p className="text-xs text-gray-400">보통 일어나는 시간을 선택해 주세요</p>
        </div>
        <button
          onClick={() => setStep(4)}
          className="mt-6 w-full py-3 bg-brand-blue text-white font-bold rounded-2xl shadow-md active:scale-95 transition-all"
        >
          다음 →
        </button>
      </SurveyShell>
    )
  }

  // Step 4 — 취침 시간
  if (step === 4) {
    return (
      <SurveyShell step={4} total={5} title="취침 시간은?" onBack={() => setStep(3)}>
        <p className="text-sm text-gray-400 mb-5 text-center">취침 루틴을 자동으로 만들어 드려요</p>
        <div className="flex flex-col items-center gap-4">
          <input
            type="time"
            value={survey.bedTime}
            onChange={e => setSurvey(s => ({ ...s, bedTime: e.target.value }))}
            className="text-3xl font-black text-brand-blue border-2 border-brand-blue/30 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
          />
          <p className="text-xs text-gray-400">보통 자는 시간을 선택해 주세요</p>
        </div>
        <button
          onClick={() => setStep(5)}
          className="mt-6 w-full py-3 bg-brand-blue text-white font-bold rounded-2xl shadow-md active:scale-95 transition-all"
        >
          다음 →
        </button>
      </SurveyShell>
    )
  }

  // Step 5 — 알람 설정
  return (
    <SurveyShell step={5} total={5} title="자녀 기기에 알람을 설정할까요?" onBack={() => setStep(4)}>
      <p className="text-sm text-gray-400 mb-6 text-center">미션 시간에 맞춰 알림을 받을 수 있어요</p>
      <div className="flex flex-col gap-3">
        <OptionButton label="설정할게요" sub="기기 알람을 켜 주세요" onClick={() => handleFinish(true)} />
        <OptionButton label="나중에 할게요" sub="지금은 건너뛰어요" onClick={() => handleFinish(false)} />
      </div>
    </SurveyShell>
  )
}

// ── 서브 컴포넌트 ─────────────────────────────────────────

function SurveyShell({
  step, total, title, children, onBack,
}: {
  step: number; total: number; title?: string
  children: React.ReactNode; onBack?: () => void
}) {
  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
      {/* 진행 바 */}
      <div className="flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="text-brand-blue text-sm font-bold mr-1">← 이전</button>
        )}
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-blue to-brand-green rounded-full transition-all duration-500"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 font-bold w-8 text-right">{step}/{total}</span>
      </div>

      {title && (
        <h2 className="text-xl font-black text-brand-text text-center leading-snug">{title}</h2>
      )}

      {children}
    </div>
  )
}

function OptionButton({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl border-2 border-transparent bg-white px-5 py-4 text-left shadow-sm transition-all hover:border-brand-blue/40 active:scale-[0.98]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-blue/10 text-sm font-black text-brand-blue">
        {label.slice(0, 1)}
      </span>
      <div>
        <p className="font-bold text-brand-text">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
      </div>
    </button>
  )
}
