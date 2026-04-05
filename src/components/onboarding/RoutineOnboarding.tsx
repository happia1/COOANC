'use client'

/**
 * 자녀 프로필 등록 직후 루틴 온보딩 (4단계)
 *
 * Step 1 — 기본 정보 (연령대 / 기관 / 학원 / 기상·취침 시간 / 알람)
 * Step 2 — 평일 루틴 블록 칩 선택
 * Step 3 — 휴일 루틴 (평일 복사 or 따로 설정)
 * Step 4 — 완료 요약
 */

import { useState, useMemo } from 'react'

// ── 상수 ───────────────────────────────────────────────────────

const DURATIONS: Record<string, number> = {
  '기상': 0, '양치': 5, '세수': 5, '아침식사': 20,
  '옷 갈아입기': 10, '가방 챙기기': 5, '신발신기': 3, '등원하기': 0,
  '손씻기': 5, '간식먹기': 15, '야외놀이': 30, '실내놀이': 20,
  '독서활동': 20, '퍼즐놀이': 20, '미술놀이': 20, '숙제하기': 30,
  '저녁식사': 20, '모두 제자리': 10, '목욕/샤워': 15,
  '잠옷 갈아입기': 5, '잠자리 독서': 15, '취침': 0,
}
const DEFAULT_DURATION = 10

type ChipType = 'fixed' | 'recommended' | 'optional'
type BlockKey = 'morning' | 'afternoon' | 'evening' | 'bedtime'

type ChipDef = { title: string; emoji: string; type: ChipType; hideWhenNoSchool?: boolean }
type BlockDef = { label: string; blockKey: BlockKey; chips: ChipDef[] }

const BLOCKS: BlockDef[] = [
  {
    label: '🌅 아침', blockKey: 'morning',
    chips: [
      { title: '기상',        emoji: '☀️',  type: 'fixed' },
      { title: '양치',        emoji: '🪥',  type: 'recommended' },
      { title: '세수',        emoji: '💧',  type: 'recommended' },
      { title: '아침식사',    emoji: '🍳',  type: 'recommended' },
      { title: '옷 갈아입기', emoji: '👕',  type: 'recommended' },
      { title: '가방 챙기기', emoji: '🎒',  type: 'optional' },
      { title: '신발신기',    emoji: '👟',  type: 'optional' },
      { title: '등원하기',    emoji: '🚌',  type: 'optional', hideWhenNoSchool: true },
    ],
  },
  {
    label: '☀️ 오후', blockKey: 'afternoon',
    chips: [
      { title: '손씻기',    emoji: '🧼',  type: 'recommended' },
      { title: '간식먹기',  emoji: '🍎',  type: 'recommended' },
      { title: '야외놀이',  emoji: '⚽',  type: 'optional' },
      { title: '실내놀이',  emoji: '🎮',  type: 'optional' },
      { title: '독서활동',  emoji: '📖',  type: 'optional' },
      { title: '퍼즐놀이',  emoji: '🧩',  type: 'optional' },
      { title: '미술놀이',  emoji: '🎨',  type: 'optional' },
      { title: '숙제하기',  emoji: '📚',  type: 'optional' },
    ],
  },
  {
    label: '🌆 저녁', blockKey: 'evening',
    chips: [
      { title: '저녁식사',    emoji: '🍽️', type: 'recommended' },
      { title: '모두 제자리', emoji: '🧹', type: 'recommended' },
      { title: '숙제하기',    emoji: '📚', type: 'optional' },
    ],
  },
  {
    label: '🌙 잠자리', blockKey: 'bedtime',
    chips: [
      { title: '세수',          emoji: '💧', type: 'recommended' },
      { title: '양치',          emoji: '🪥', type: 'recommended' },
      { title: '잠옷 갈아입기', emoji: '👕', type: 'recommended' },
      { title: '목욕/샤워',     emoji: '🛁', type: 'optional' },
      { title: '잠자리 독서',   emoji: '📖', type: 'optional' },
      { title: '취침',          emoji: '🌙', type: 'fixed' },
    ],
  },
]

/** 기관 없을 때 기본 선택 (고정 + 추천) */
function defaultSelected(block: BlockDef, hasSchool: boolean): string[] {
  return block.chips
    .filter(c => {
      if (c.hideWhenNoSchool && !hasSchool) return false
      return c.type === 'fixed' || c.type === 'recommended'
    })
    .map(c => c.title)
}

// ── 시간 유틸 ────────────────────────────────────────────────

function addMins(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
function subMins(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = (h * 60 + m - mins + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** 아침/오후/저녁 순방향, 잠자리 역산 */
function assignTimes(
  selected: Record<BlockKey, string[]>,
  wakeTime: string,
  sleepTime: string,
  academyReturnTime: string,
): Record<string, string> {
  const result: Record<string, string> = {}

  // 아침: 기상 시간부터 순차
  let cur = wakeTime
  for (const title of selected.morning) {
    result[`morning:${title}`] = cur
    cur = addMins(cur, DURATIONS[title] ?? DEFAULT_DURATION)
  }

  // 오후: 학원 귀원 시간 or 14:00부터
  cur = academyReturnTime || '14:00'
  for (const title of selected.afternoon) {
    result[`afternoon:${title}`] = cur
    cur = addMins(cur, DURATIONS[title] ?? DEFAULT_DURATION)
  }

  // 저녁: 18:00
  cur = '18:00'
  for (const title of selected.evening) {
    result[`evening:${title}`] = cur
    cur = addMins(cur, DURATIONS[title] ?? DEFAULT_DURATION)
  }

  // 잠자리: 취침 시간에서 역산
  const bedtimeMissions = [...selected.bedtime].reverse()
  let back = sleepTime
  for (const title of bedtimeMissions) {
    result[`bedtime:${title}`] = back
    back = subMins(back, DURATIONS[title] ?? DEFAULT_DURATION)
  }

  return result
}

/** "HH:MM" → "오전/오후 H:MM" */
function fmt(t: string): string {
  const [h, m] = t.split(':').map(Number)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`
}

// ── 타입 ────────────────────────────────────────────────────

type AgeGroup = 'preschool' | 'school'
type InstitutionType = 'home' | 'daycare' | 'kindergarten' | 'school'
type Academy = { name: string; returnTime: string }

type RoutineSelections = Record<BlockKey, string[]>

interface Props {
  childName: string
  onComplete: () => void
}

// ── 메인 컴포넌트 ────────────────────────────────────────────

export default function RoutineOnboarding({ childName, onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1 state
  const [ageGroup, setAgeGroup]               = useState<AgeGroup>('school')
  const [institutionType, setInstitutionType] = useState<InstitutionType>('school')
  const [academies, setAcademies]             = useState<Academy[]>([])
  const [wakeTime, setWakeTime]               = useState('07:00')
  const [sleepTime, setSleepTime]             = useState('21:00')
  const [alarmEnabled, setAlarmEnabled]       = useState(false)

  // Step 2 — 평일 루틴 선택
  const hasSchool = institutionType !== 'home'
  const [weekday, setWeekday] = useState<RoutineSelections>(() =>
    Object.fromEntries(BLOCKS.map(b => [b.blockKey, defaultSelected(b, hasSchool)])) as RoutineSelections
  )
  // 직접 입력 칩
  const [customInputs, setCustomInputs] = useState<Record<BlockKey, string>>({
    morning: '', afternoon: '', evening: '', bedtime: '',
  })

  // Step 3 — 휴일 루틴
  const [sameAsWeekday, setSameAsWeekday] = useState<boolean | null>(null)
  const [holiday, setHoliday] = useState<RoutineSelections>(() =>
    Object.fromEntries(BLOCKS.map(b => [b.blockKey, defaultSelected(b, false)])) as RoutineSelections
  )

  // ── 학원 귀원 시간 (오후 블록 기준)
  const latestAcademyReturn = useMemo(() => {
    if (!academies.length) return ''
    const sorted = [...academies].sort((a, b) => b.returnTime.localeCompare(a.returnTime))
    return sorted[0].returnTime
  }, [academies])

  // 미리보기 시간 배분
  const weekdayTimes = useMemo(
    () => assignTimes(weekday, wakeTime, sleepTime, latestAcademyReturn),
    [weekday, wakeTime, sleepTime, latestAcademyReturn]
  )
  const holidayTimes = useMemo(
    () => assignTimes(holiday, wakeTime, sleepTime, ''),
    [holiday, wakeTime, sleepTime]
  )

  // ── 칩 토글 ──────────────────────────────────────────────

  function toggleChip(sel: RoutineSelections, setSel: (s: RoutineSelections) => void, blockKey: BlockKey, title: string, isFixed: boolean) {
    if (isFixed) return
    setSel({
      ...sel,
      [blockKey]: sel[blockKey].includes(title)
        ? sel[blockKey].filter(t => t !== title)
        : [...sel[blockKey], title],
    })
  }

  function addCustomChip(sel: RoutineSelections, setSel: (s: RoutineSelections) => void, blockKey: BlockKey) {
    const title = customInputs[blockKey].trim()
    if (!title || sel[blockKey].includes(title)) return
    setSel({ ...sel, [blockKey]: [...sel[blockKey], title] })
    setCustomInputs(prev => ({ ...prev, [blockKey]: '' }))
  }

  // ── 미션 생성 API 호출 ────────────────────────────────────

  async function createMissions(selections: RoutineSelections, times: Record<string, string>, repeatType: 'daily' | 'weekly') {
    const allMissions: { title: string; block: BlockKey; emoji: string; time: string }[] = []

    for (const blockDef of BLOCKS) {
      const bk = blockDef.blockKey
      for (const title of selections[bk]) {
        const chip = blockDef.chips.find(c => c.title === title)
        const emoji = chip?.emoji ?? '⭐'
        const time  = times[`${bk}:${title}`] ?? ''
        allMissions.push({ title, block: bk, emoji, time })
      }
    }

    for (const m of allMissions) {
      const res = await fetch('/api/mission/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:          m.title,
          icon_emoji:     m.emoji,
          block:          m.block,
          scheduled_time: m.time || null,
          credit_reward:  10,
          exp_reward:     10,
          heart_reward:   0,
          difficulty:     'easy',
          repeat_type:    repeatType,
          level_required: 0,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? '미션 생성 실패')
      }
    }
  }

  async function handleFinish() {
    setSubmitting(true)
    setError(null)
    try {
      // 평일 미션 생성
      await createMissions(weekday, weekdayTimes, 'daily')
      // 휴일 미션이 평일과 다를 때만 추가 (주말용 repeat_type은 daily와 같으나 구분 필요 시 확장)
      if (sameAsWeekday === false) {
        await createMissions(holiday, holidayTimes, 'weekly')
      }
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : '미션 생성 중 오류가 발생했어요.')
      setSubmitting(false)
    }
  }

  // ── 렌더 분기 ────────────────────────────────────────────

  if (submitting) {
    return (
      <Shell step={4} total={4}>
        <div className="flex flex-col items-center gap-4 py-10">
          <span className="text-6xl animate-spin">⚙️</span>
          <p className="font-bold text-brand-text">루틴을 만들고 있어요…</p>
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 text-center">{error}</p>}
        </div>
      </Shell>
    )
  }

  // ════════════════════════════════════════════
  // Step 1 — 기본 정보
  // ════════════════════════════════════════════
  if (step === 1) return (
    <Shell step={1} total={4} title={`${childName}에 대해 알려주세요`}>
      <div className="flex flex-col gap-5">

        {/* 연령대 */}
        <div>
          <p className="text-xs font-bold text-gray-500 mb-2">연령대</p>
          <div className="flex gap-2">
            {([['preschool', '🐣 미취학', '7세 미만'], ['school', '🎒 학령기', '초등학생 이상']] as const).map(([v, l, s]) => (
              <button key={v} onClick={() => setAgeGroup(v)}
                className={`flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all ${ageGroup === v ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-gray-200 text-gray-500'}`}>
                {l}<br/><span className="text-[10px] font-normal">{s}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 기관 형태 */}
        <div>
          <p className="text-xs font-bold text-gray-500 mb-2">기관 형태</p>
          <div className="grid grid-cols-2 gap-2">
            {(ageGroup === 'preschool'
              ? [['home','🏠 가정보육'],['daycare','🏫 어린이집'],['kindergarten','🌸 유치원']] as const
              : [['school','🏫 학교'],['home','🏠 홈스쿨']] as const
            ).map(([v, l]) => (
              <button key={v} onClick={() => setInstitutionType(v as InstitutionType)}
                className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${institutionType === v ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-gray-200 text-gray-500'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* 학원 (학령기 + 학교 선택 시) */}
        {ageGroup === 'school' && institutionType !== 'home' && (
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2">학원 <span className="font-normal">(최대 3개, 선택)</span></p>
            {academies.map((ac, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input value={ac.name} onChange={e => setAcademies(prev => prev.map((a,j) => j===i ? {...a, name:e.target.value} : a))}
                  placeholder="학원명" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"/>
                <input type="time" value={ac.returnTime} onChange={e => setAcademies(prev => prev.map((a,j) => j===i ? {...a, returnTime:e.target.value} : a))}
                  className="border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"/>
                <button onClick={() => setAcademies(prev => prev.filter((_,j) => j !== i))} className="text-red-400 font-bold px-2">✕</button>
              </div>
            ))}
            {academies.length < 3 && (
              <button onClick={() => setAcademies(prev => [...prev, { name:'', returnTime:'17:00' }])}
                className="text-sm text-brand-blue font-bold">+ 학원 추가</button>
            )}
          </div>
        )}

        {/* 기상 / 취침 시간 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-bold text-gray-500 mb-1">☀️ 기상 시간</p>
            <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/40"/>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 mb-1">🌙 취침 시간</p>
            <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/40"/>
          </div>
        </div>

        {/* 알람 */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-bold text-brand-text">⏰ 자녀 기기 알람 설정</p>
            <p className="text-xs text-gray-400">미션 시간마다 알림을 받아요</p>
          </div>
          <button onClick={() => setAlarmEnabled(v => !v)}
            className={`w-12 h-6 rounded-full transition-all relative ${alarmEnabled ? 'bg-brand-blue' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${alarmEnabled ? 'left-6' : 'left-0.5'}`}/>
          </button>
        </div>

        <button onClick={() => setStep(2)}
          className="w-full py-3 bg-brand-blue text-white font-bold rounded-2xl shadow-md active:scale-95 transition-all">
          다음 — 루틴 설정 →
        </button>
      </div>
    </Shell>
  )

  // ════════════════════════════════════════════
  // Step 2 — 평일 루틴 블록 칩 선택
  // ════════════════════════════════════════════
  if (step === 2) return (
    <Shell step={2} total={4} title="평일 루틴을 골라주세요" onBack={() => setStep(1)}>
      <p className="text-xs text-gray-400 -mt-2 mb-4 text-center">★ 고정  · 추천 미리 선택  · 나머지는 선택</p>
      <div className="flex flex-col gap-5">
        {BLOCKS.map(blockDef => {
          const bk = blockDef.blockKey
          // 학원 칩 자동 추가 (오후 블록)
          const extraAcademyChips: ChipDef[] = bk === 'afternoon'
            ? academies.filter(a => a.name.trim()).map(a => ({
                title: `${a.name.trim()} 가기`, emoji: '🏫', type: 'optional' as const,
              }))
            : []
          const chips = [...blockDef.chips.filter(c => !c.hideWhenNoSchool || hasSchool), ...extraAcademyChips]
          const currentSel = weekday[bk]

          return (
            <BlockSection key={bk} label={blockDef.label}>
              <div className="flex flex-wrap gap-2">
                {chips.map(chip => {
                  const selected = currentSel.includes(chip.title)
                  const isFixed  = chip.type === 'fixed'
                  return (
                    <button key={chip.title}
                      onClick={() => toggleChip(weekday, setWeekday, bk, chip.title, isFixed)}
                      className={[
                        'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all',
                        isFixed     ? 'border-brand-blue bg-brand-blue/10 text-brand-blue cursor-default' :
                        selected    ? 'border-brand-green bg-brand-green/10 text-brand-green' :
                                      'border-gray-200 text-gray-400',
                      ].join(' ')}>
                      <span>{chip.emoji}</span>
                      <span>{chip.title}</span>
                      {isFixed && <span className="text-[9px]">★</span>}
                      {chip.type === 'recommended' && <span className="text-[9px] text-gray-400">추천</span>}
                    </button>
                  )
                })}
              </div>

              {/* 시간 미리보기 */}
              {currentSel.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                  {currentSel.map(t => {
                    const key = `${bk}:${t}`
                    return weekdayTimes[key]
                      ? <span key={t} className="text-[10px] text-gray-400">🕐 {fmt(weekdayTimes[key])} {t}</span>
                      : null
                  })}
                </div>
              )}

              {/* 직접 입력 */}
              <div className="flex gap-2 mt-2">
                <input value={customInputs[bk]}
                  onChange={e => setCustomInputs(prev => ({ ...prev, [bk]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addCustomChip(weekday, setWeekday, bk)}
                  placeholder="직접 입력…"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/30"/>
                <button onClick={() => addCustomChip(weekday, setWeekday, bk)}
                  className="text-xs font-bold text-brand-blue px-2">추가</button>
              </div>
            </BlockSection>
          )
        })}

        <button onClick={() => setStep(3)}
          className="w-full py-3 bg-brand-blue text-white font-bold rounded-2xl shadow-md active:scale-95 transition-all">
          다음 — 휴일 루틴 →
        </button>
      </div>
    </Shell>
  )

  // ════════════════════════════════════════════
  // Step 3 — 휴일 루틴
  // ════════════════════════════════════════════
  if (step === 3) {
    if (sameAsWeekday === null) return (
      <Shell step={3} total={4} title="휴일 루틴은 어떻게 할까요?" onBack={() => setStep(2)}>
        <div className="flex flex-col gap-3 mt-4">
          <OptionBtn emoji="📋" label="평일 루틴과 같게 할게요" sub="복사해서 그대로 적용"
            onClick={() => { setSameAsWeekday(true); setStep(4) }}/>
          <OptionBtn emoji="✏️" label="따로 설정할게요" sub="블록에서 원하는 것만 선택"
            onClick={() => setSameAsWeekday(false)}/>
        </div>
      </Shell>
    )

    // 따로 설정
    return (
      <Shell step={3} total={4} title="휴일 루틴을 골라주세요" onBack={() => setSameAsWeekday(null)}>
        <div className="flex flex-col gap-5">
          {BLOCKS.map(blockDef => {
            const bk   = blockDef.blockKey
            // 휴일엔 등원·학원 칩 숨김
            const chips = blockDef.chips.filter(c => !c.hideWhenNoSchool)
            const curSel = holiday[bk]

            return (
              <BlockSection key={bk} label={blockDef.label}>
                <div className="flex flex-wrap gap-2">
                  {chips.map(chip => {
                    const selected = curSel.includes(chip.title)
                    const isFixed  = chip.type === 'fixed'
                    return (
                      <button key={chip.title}
                        onClick={() => toggleChip(holiday, setHoliday, bk, chip.title, isFixed)}
                        className={[
                          'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all',
                          isFixed  ? 'border-brand-blue bg-brand-blue/10 text-brand-blue cursor-default' :
                          selected ? 'border-brand-green bg-brand-green/10 text-brand-green' :
                                     'border-gray-200 text-gray-400',
                        ].join(' ')}>
                        <span>{chip.emoji}</span><span>{chip.title}</span>
                      </button>
                    )
                  })}
                </div>
                {curSel.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                    {curSel.map(t => {
                      const k = `${bk}:${t}`
                      return holidayTimes[k]
                        ? <span key={t} className="text-[10px] text-gray-400">🕐 {fmt(holidayTimes[k])} {t}</span>
                        : null
                    })}
                  </div>
                )}
              </BlockSection>
            )
          })}
          <button onClick={() => setStep(4)}
            className="w-full py-3 bg-brand-blue text-white font-bold rounded-2xl shadow-md active:scale-95 transition-all">
            다음 — 완료 확인 →
          </button>
        </div>
      </Shell>
    )
  }

  // ════════════════════════════════════════════
  // Step 4 — 완료 요약
  // ════════════════════════════════════════════
  const totalWeekday = Object.values(weekday).flat().length
  const totalHoliday = sameAsWeekday === false ? Object.values(holiday).flat().length : totalWeekday

  return (
    <Shell step={4} total={4} title="이렇게 루틴을 시작해요!" onBack={() => setStep(3)}>
      <div className="flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 mb-3">📋 평일 루틴 ({totalWeekday}개)</p>
          {BLOCKS.map(b => {
            const missions = weekday[b.blockKey]
            if (!missions.length) return null
            return (
              <div key={b.blockKey} className="mb-2">
                <p className="text-[11px] font-bold text-gray-400 mb-1">{b.label}</p>
                <div className="flex flex-wrap gap-1">
                  {missions.map(t => {
                    const k = `${b.blockKey}:${t}`
                    return (
                      <span key={t} className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                        {weekdayTimes[k] ? `${fmt(weekdayTimes[k])} ` : ''}{t}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {sameAsWeekday === false && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 mb-3">🌿 휴일 루틴 ({totalHoliday}개)</p>
            {BLOCKS.map(b => {
              const missions = holiday[b.blockKey]
              if (!missions.length) return null
              return (
                <div key={b.blockKey} className="mb-2">
                  <p className="text-[11px] font-bold text-gray-400 mb-1">{b.label}</p>
                  <div className="flex flex-wrap gap-1">
                    {missions.map(t => (
                      <span key={t} className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {sameAsWeekday === true && (
          <p className="text-xs text-center text-gray-400">휴일도 평일 루틴과 동일하게 적용돼요</p>
        )}

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 text-center">{error}</p>}

        <button onClick={handleFinish}
          className="w-full py-4 bg-brand-green text-white font-black text-base rounded-2xl shadow-md active:scale-95 transition-all">
          루틴 시작하기 🎉
        </button>
        <button onClick={onComplete} className="text-xs text-gray-400 underline text-center">
          나중에 수정할게요 (루틴 탭에서 언제든 변경 가능)
        </button>
      </div>
    </Shell>
  )
}

// ── 공용 서브 컴포넌트 ────────────────────────────────────────

function Shell({ step, total, title, children, onBack }: {
  step: number; total: number; title?: string
  children: React.ReactNode; onBack?: () => void
}) {
  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="text-brand-blue text-sm font-bold shrink-0">← 이전</button>
        )}
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-blue to-brand-green rounded-full transition-all duration-500"
            style={{ width: `${(step / total) * 100}%` }}/>
        </div>
        <span className="text-xs text-gray-400 font-bold w-8 text-right shrink-0">{step}/{total}</span>
      </div>
      {title && <h2 className="text-lg font-black text-brand-text text-center leading-snug">{title}</h2>}
      {children}
    </div>
  )
}

function BlockSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-sm font-black text-brand-text mb-3">{label}</p>
      {children}
    </div>
  )
}

function OptionBtn({ emoji, label, sub, onClick }: {
  emoji: string; label: string; sub?: string; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-4 bg-white rounded-2xl px-5 py-4 shadow-sm border-2 border-transparent hover:border-brand-blue/40 active:scale-[0.98] transition-all text-left">
      <span className="text-3xl shrink-0">{emoji}</span>
      <div>
        <p className="font-bold text-brand-text">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </button>
  )
}
