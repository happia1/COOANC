'use client'

/**
 * 자녀 프로필 등록 직후 루틴 온보딩 (3단계)
 *
 * 1단계 — 연령·기관·「일정별 알람」: 부모 루틴 알람 시트와 동일하게 기상·등원·하원·귀가·잘 준비·잘 시간(주중·주말 토글 + 소리)
 *    「알람 소리 선택」팝업은 소리 목록을 **기상 / 등원 / 취침 / 기타** 네 구역 카드로 나눠 보여 줍니다(온보딩 전용 강조 UI).
 * 2단계 — 평일·휴일 루틴 한 화면: 평일 오전·오후·저녁 칩(한 줄) + 휴일은 「평일과 같음」/「휴일만 따로」(후자 선택 시 휴일 블록 표시) 후 완료
 *
 * (구) 4단계 요약 화면은 없습니다. 키워드는 미리 정의된 목록만 쓰며, 새 미션은 설정의 「미션 추가 제안」으로 안내합니다.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useAlarmSoundPreview } from '@/hooks/useAlarmSoundPreview'
import {
  writeRoutineAlarmPrefs,
  type RoutineCustomAlarmStored,
} from '@/lib/routineAlarmLocalPrefs'
import { createClient } from '@/lib/supabase/client'
import RoutineAlarmSoundToggleList, {
  type AlarmSoundPickRow,
} from '@/components/common/RoutineAlarmSoundToggleList'
import { DEFAULT_ROUTINE_ALARM_SOUND_IDS, mergeRoutineAlarmPickListFromApi } from '@/lib/routineAlarmSounds'
import {
  AM_CHIPS,
  PM_CHIPS,
  defaultSelectedIds,
  toggleChipId,
  type ApiBlock,
  type ChipDef,
} from '@/lib/routineChips'
import { routineMissionIconEmojiForCreate } from '@/lib/routineMissionThumbnail'

/**
 * 알림용 scheduled_time (HH:MM). 끄면 null → 그 시각 푸시에 안 씀.
 * 학교 다닐 때: 오후 줄에서 맨 앞에 오는 활동에 하원·귀가 시각을 붙임.
 */
function scheduledTimeForChip(
  chip: ChipDef,
  opts: {
    selPmIds: string[]
    wake: string
    sleep: string
    schoolTime: string
    returnAnchor: string
    hasSchool: boolean
    notifyWake: boolean
    notifyReturn: boolean
    notifySleep: boolean
    schoolWeekday: boolean
    schoolWeekend: boolean
  },
): string | null {
  if (chip.title === '기상') {
    return opts.notifyWake && /^\d{2}:\d{2}$/.test(opts.wake) ? opts.wake : null
  }
  if (chip.title === '잘 시간' || chip.title === '취침') {
    return opts.notifySleep && /^\d{2}:\d{2}$/.test(opts.sleep) ? opts.sleep : null
  }
  /** 등원 미션 칩은 별도 «등원» 알람 시각·사용 여부를 따름(부모 루틴 알람과 동일; 기관 선택과 무관하게 등원 행 설정과 맞춤) */
  if (chip.title === '등원하기') {
    const st = opts.schoolTime.trim()
    if (!(opts.schoolWeekday || opts.schoolWeekend)) return null
    return /^\d{2}:\d{2}$/.test(st) ? st : null
  }
  const firstPm = opts.selPmIds[0]
  if (opts.hasSchool && firstPm && chip.id === firstPm) {
    const a = opts.returnAnchor.trim()
    return opts.notifyReturn && /^\d{2}:\d{2}$/.test(a) ? a : null
  }
  return null
}

/** HH:MM → 분 (정렬용) */
function minutesFromHHMM(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2])
}

/** 시각에 맞춰 API block 추정 (추가 알람 미션용) */
function blockFromTimeHHMM(t: string): ApiBlock {
  const h = Math.floor(minutesFromHHMM(t) / 60)
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 21) return 'evening'
  return 'bedtime'
}

/** 미션 description에 알람 파일명 저장 (클라이언트에서 `/assets/audio/alarm/` 붙여 재생) */
function alarmDescription(alarmFile: string | null | undefined): string | null {
  if (!alarmFile?.trim()) return null
  return JSON.stringify({ v: 1 as const, alarmFile: alarmFile.trim() })
}

function missionDescriptionForChip(
  chip: ChipDef,
  pmIds: string[],
  soundWake: string,
  soundSchool: string,
  soundReturn: string,
  soundSleep: string,
  hasSchool: boolean,
): string | null {
  if (chip.title === '기상') return alarmDescription(soundWake)
  if (chip.title === '잘 시간' || chip.title === '취침') return alarmDescription(soundSleep)
  if (chip.title === '등원하기') return alarmDescription(soundSchool)
  const firstPm = pmIds[0]
  if (hasSchool && firstPm && chip.id === firstPm) return alarmDescription(soundReturn)
  return null
}

function sortRowTie(rowId: string): string {
  if (rowId === 'wake') return '0'
  if (rowId === 'school') return '1'
  if (rowId === 'return') return '2'
  if (rowId === 'sleepReady') return '3'
  if (rowId === 'sleep') return '4'
  return `5-${rowId}`
}

type AgeGroup = 'preschool' | 'school'
type InstitutionType = 'home' | 'daycare' | 'kindergarten' | 'school'

/** 휴일 루틴: 평일 미션과 동일 vs 휴일 전용 칩 따로 고름 */
type HolidayRoutineMode = 'as_weekday' | 'custom'

interface Props {
  onComplete: () => void
  /**
   * 방금 등록한 자녀 프로필 id — 생성되는 미션 행에 linked_child_id 로 저장합니다.
   * 자녀 삭제 시 DB CASCADE 로 해당 미션만 함께 지워져 루틴 탭에 남지 않습니다.
   */
  linkedChildId: string | null
}

export default function RoutineOnboarding({ onComplete, linkedChildId }: Props) {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [ageGroup, setAgeGroup] = useState<AgeGroup>('school')
  const [institutionType, setInstitutionType] = useState<InstitutionType>('school')
  const [wakeTime, setWakeTime] = useState('07:00')
  const [sleepTime, setSleepTime] = useState('21:00')
  const [returnHomeTime, setReturnHomeTime] = useState('15:00')

  /** 기상 / 하원·귀가(첫 오후 활동) / 잘 시간 알림 각각 주중 스위치(전역 notify_* 플래그)로 켜짐 여부 */
  const [notifyWake, setNotifyWake] = useState(true)
  const [notifyReturn, setNotifyReturn] = useState(true)
  const [notifySleep, setNotifySleep] = useState(true)

  /** 알람 음원 (파일명 id) — `/api/assets/alarm-sounds` 로 목록 로드 */
  const [alarmSounds, setAlarmSounds] = useState<AlarmSoundPickRow[]>([])
  const [soundWake, setSoundWake] = useState('')
  const [soundReturn, setSoundReturn] = useState('')
  const [soundSleep, setSoundSleep] = useState('')
  /** 등원·잘 준비 알람 음원 id — 부모 앱 RoutineAlarmSettingsSheet 와 동일 키 */
  const [soundSchool, setSoundSchool] = useState('')
  const [soundSleepReady, setSoundSleepReady] = useState('')

  /** 기상·하원·잘 시간: 주중 ON 은 cooanc_notify_* , 주말 ON 은 cooanc_alarm_prefs 의 *OnWeekend */
  const [wakeOnWeekend, setWakeOnWeekend] = useState(true)
  const [returnOnWeekend, setReturnOnWeekend] = useState(true)
  const [sleepOnWeekend, setSleepOnWeekend] = useState(true)

  /** 등원 알람 시각 및 주중/주말(부모 시트와 동일 — child_stats.school_time* 로도 저장) */
  const [schoolTime, setSchoolTime] = useState('08:30')
  const [schoolWeekday, setSchoolWeekday] = useState(true)
  const [schoolWeekend, setSchoolWeekend] = useState(true)

  /** 잘 준비 알람 */
  const [sleepReadyTime, setSleepReadyTime] = useState('20:30')
  const [sleepReadyWeekday, setSleepReadyWeekday] = useState(true)
  const [sleepReadyWeekend, setSleepReadyWeekend] = useState(true)

  const [customAlarms, setCustomAlarms] = useState<RoutineCustomAlarmStored[]>([])
  /** 상단 휴지통: 추가 일정만 체크 후 일괄 삭제 */
  const [alarmDeleteMode, setAlarmDeleteMode] = useState(false)
  const [selectedAlarmDeleteIds, setSelectedAlarmDeleteIds] = useState<Set<string>>(() => new Set())

  /** 하단 시트: 일정 추가 또는 행별 소리 선택 */
  const [sheet, setSheet] = useState<
    { open: false } | { open: true; mode: 'add' } | { open: true; mode: 'sound'; rowId: string }
  >({ open: false })
  const [sheetLabel, setSheetLabel] = useState('')
  const [sheetTime, setSheetTime] = useState('12:00')
  const [sheetNotify, setSheetNotify] = useState(true)
  const [sheetSound, setSheetSound] = useState('')
  /** 소리 전용 시트에서 임시로 고른 파일 id */
  const [pickerSound, setPickerSound] = useState('')

  /** 2단계 — 미션 추가 제안 바텀시트(추후 메일 연동 전까지 팝업·API 로그만) */
  const [missionSuggestOpen, setMissionSuggestOpen] = useState(false)
  const [suggestMissionTitle, setSuggestMissionTitle] = useState('')
  const [suggestMissionDetail, setSuggestMissionDetail] = useState('')
  const [suggestSubmitMsg, setSuggestSubmitMsg] = useState<string | null>(null)
  const [suggestSubmitting, setSuggestSubmitting] = useState(false)

  const {
    play: alarmPreviewPlay,
    stop: stopAlarmPreview,
    playingId: alarmPreviewPlayingId,
  } = useAlarmSoundPreview()

  useEffect(() => {
    if (!sheet.open) stopAlarmPreview()
  }, [sheet.open, stopAlarmPreview])

  useEffect(() => {
    let cancelled = false
    fetch('/api/assets/alarm-sounds', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { sounds?: AlarmSoundPickRow[] }) => {
        if (cancelled) return
        const raw = Array.isArray(j.sounds) ? j.sounds : []
        const list = mergeRoutineAlarmPickListFromApi(raw)
        setAlarmSounds(list)
        const first = list[0]?.id ?? ''
        setSoundWake((p) => p || DEFAULT_ROUTINE_ALARM_SOUND_IDS.wake || first)
        setSoundReturn((p) => p || DEFAULT_ROUTINE_ALARM_SOUND_IDS.returnHome || first)
        setSoundSleep((p) => p || DEFAULT_ROUTINE_ALARM_SOUND_IDS.sleep || first)
        setSoundSchool((p) => p || DEFAULT_ROUTINE_ALARM_SOUND_IDS.school || first)
        setSoundSleepReady((p) => p || DEFAULT_ROUTINE_ALARM_SOUND_IDS.sleepReady || first)
        setSheetSound((p) => p || first)
        setPickerSound((p) => p || first)
      })
      .catch(() => {
        if (cancelled) return
        const list = mergeRoutineAlarmPickListFromApi([])
        setAlarmSounds(list)
        const first = list[0]?.id ?? ''
        setSoundWake((p) => p || DEFAULT_ROUTINE_ALARM_SOUND_IDS.wake || first)
        setSoundReturn((p) => p || DEFAULT_ROUTINE_ALARM_SOUND_IDS.returnHome || first)
        setSoundSleep((p) => p || DEFAULT_ROUTINE_ALARM_SOUND_IDS.sleep || first)
        setSoundSchool((p) => p || DEFAULT_ROUTINE_ALARM_SOUND_IDS.school || first)
        setSoundSleepReady((p) => p || DEFAULT_ROUTINE_ALARM_SOUND_IDS.sleepReady || first)
        setSheetSound((p) => p || first)
        setPickerSound((p) => p || first)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * 잘 시간 행에서만 소리 시트 목록을 재정렬 — 기본 선택 id(sleep_time_alert) pill이 목록 최상단에 오게 해
   * 스크롤 영역이 짧아서 아래 줄에 숨는 문제를 줄입니다.
   */
  const soundsForSoundSheetPicker = useMemo(() => {
    if (!sheet.open || sheet.mode !== 'sound') return alarmSounds
    if (sheet.rowId !== 'sleep') return alarmSounds
    const sid = DEFAULT_ROUTINE_ALARM_SOUND_IDS.sleep
    const ix = alarmSounds.findIndex((s) => s.id === sid)
    if (ix <= 0) return alarmSounds
    const next = [...alarmSounds]
    const [picked] = next.splice(ix, 1)
    return [picked, ...next]
  }, [alarmSounds, sheet])

  const soundLabel = useCallback(
    (fileId: string) => alarmSounds.find((s) => s.id === fileId)?.label ?? (fileId ? fileId : '소리'),
    [alarmSounds],
  )

  const openAddSheet = useCallback(() => {
    const first = alarmSounds[0]?.id ?? ''
    setAlarmDeleteMode(false)
    setSelectedAlarmDeleteIds(new Set())
    setSheetLabel('')
    setSheetTime('12:00')
    setSheetNotify(true)
    setSheetSound(first)
    setSheet({ open: true, mode: 'add' })
  }, [alarmSounds])

  const cancelAlarmDeleteMode = useCallback(() => {
    setAlarmDeleteMode(false)
    setSelectedAlarmDeleteIds(new Set())
  }, [])

  const toggleAlarmDeleteSelect = useCallback((rowId: string) => {
    setSelectedAlarmDeleteIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }, [])

  const confirmAlarmDeleteSelected = useCallback(() => {
    setCustomAlarms((prev) => prev.filter((c) => !selectedAlarmDeleteIds.has(c.id)))
    cancelAlarmDeleteMode()
  }, [selectedAlarmDeleteIds, cancelAlarmDeleteMode])

  const onTrashAlarmClick = useCallback(() => {
    if (customAlarms.length === 0) return
    if (alarmDeleteMode) cancelAlarmDeleteMode()
    else setAlarmDeleteMode(true)
  }, [customAlarms.length, alarmDeleteMode, cancelAlarmDeleteMode])

  const openSoundSheet = useCallback(
    (rowId: string) => {
      let current = ''
      if (rowId === 'wake') current = soundWake
      else if (rowId === 'return') current = soundReturn
      else if (rowId === 'sleep') current = soundSleep
      else if (rowId === 'school') current = soundSchool
      else if (rowId === 'sleepReady') current = soundSleepReady
      else current = customAlarms.find((c) => c.id === rowId)?.soundFile ?? ''
      setPickerSound(current || alarmSounds[0]?.id || '')
      setSheet({ open: true, mode: 'sound', rowId })
    },
    [soundWake, soundReturn, soundSleep, soundSchool, soundSleepReady, customAlarms, alarmSounds],
  )

  /** 루틴 설정 화면에서 미션 제안 보내기 — 서버는 로그만 남기고, 메일 자동화는 추후 연결 */
  const submitMissionSuggestion = useCallback(async () => {
    setSuggestSubmitMsg(null)
    const title = suggestMissionTitle.trim()
    const detail = suggestMissionDetail.trim()
    if (title.length < 1) {
      setSuggestSubmitMsg('추가하고 싶은 미션 이름을 적어 주세요.')
      return
    }
    const combined = `[루틴 온보딩] 미션: ${title}${detail ? `\n상세: ${detail}` : ''}`
    if (combined.length > 2000) {
      setSuggestSubmitMsg('전체 글자 수를 2000자 이내로 줄여 주세요.')
      return
    }
    setSuggestSubmitting(true)
    try {
      const res = await fetch('/api/feedback/mission-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: combined }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSuggestSubmitMsg(typeof j.error === 'string' ? j.error : '전송에 실패했어요.')
        return
      }
      setSuggestMissionTitle('')
      setSuggestMissionDetail('')
      setMissionSuggestOpen(false)
    } catch {
      setSuggestSubmitMsg('네트워크 오류가 났어요.')
    } finally {
      setSuggestSubmitting(false)
    }
  }, [suggestMissionTitle, suggestMissionDetail])

  const applyPickerSound = useCallback(() => {
    if (sheet.open !== true || sheet.mode !== 'sound') return
    const rowId = sheet.rowId
    const v = pickerSound
    if (rowId === 'wake') setSoundWake(v)
    else if (rowId === 'return') setSoundReturn(v)
    else if (rowId === 'sleep') setSoundSleep(v)
    else if (rowId === 'school') setSoundSchool(v)
    else if (rowId === 'sleepReady') setSoundSleepReady(v)
    else setCustomAlarms((prev) => prev.map((c) => (c.id === rowId ? { ...c, soundFile: v } : c)))
    setSheet({ open: false })
  }, [sheet, pickerSound])

  const submitAddSheet = useCallback(() => {
    const label = sheetLabel.trim()
    if (!label) return
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const first = alarmSounds[0]?.id ?? ''
    setCustomAlarms((prev) => [
      ...prev,
      {
        id,
        label,
        time: sheetTime,
        notify: sheetNotify,
        soundFile: sheetSound || first,
        onWeekend: true,
      },
    ])
    setSheet({ open: false })
  }, [sheetLabel, sheetTime, sheetNotify, sheetSound, alarmSounds])

  const hasSchool = institutionType !== 'home'

  const [weekdayAm, setWeekdayAm] = useState<string[]>(() => defaultSelectedIds(AM_CHIPS, hasSchool))
  const [weekdayPm, setWeekdayPm] = useState<string[]>(() => defaultSelectedIds(PM_CHIPS, hasSchool))

  const [holidayRoutineMode, setHolidayRoutineMode] = useState<HolidayRoutineMode>('as_weekday')
  const [holidayAm, setHolidayAm] = useState<string[]>(() => defaultSelectedIds(AM_CHIPS, false))
  const [holidayPm, setHolidayPm] = useState<string[]>(() => defaultSelectedIds(PM_CHIPS, false))

  const returnAnchor = useMemo(() => {
    if (returnHomeTime && /^\d{2}:\d{2}$/.test(returnHomeTime)) return returnHomeTime
    return '15:00'
  }, [returnHomeTime])

  /** 화면에 그릴 알람 행 — 시각 오름차순, 같은 시각이면 기상→등원→하원→잘 준비→잘 시간→추가 순 */
  const sortedAlarmRows = useMemo(() => {
    type Row = {
      rowId: string
      label: string
      minutes: number
      time: string
      setTime: (t: string) => void
      /** 부모 시트 「주중」 열과 동일 의미 — 등원·잘 준비는 해당 주중 토글, 그 외는 알림 자체 on */
      weekdayNotify: boolean
      setWeekdayNotify: (v: boolean) => void
      weekendNotify: boolean
      setWeekendNotify: (v: boolean) => void
      soundFile: string
      deletable: boolean
    }
    const rows: Row[] = []
    rows.push({
      rowId: 'wake',
      label: '기상',
      minutes: minutesFromHHMM(wakeTime),
      time: wakeTime,
      setTime: setWakeTime,
      weekdayNotify: notifyWake,
      setWeekdayNotify: setNotifyWake,
      weekendNotify: wakeOnWeekend,
      setWeekendNotify: setWakeOnWeekend,
      soundFile:       soundWake,
      deletable: false,
    })
    rows.push({
      rowId: 'school',
      label: '등원',
      minutes: minutesFromHHMM(schoolTime),
      time: schoolTime,
      setTime: setSchoolTime,
      weekdayNotify: schoolWeekday,
      setWeekdayNotify: setSchoolWeekday,
      weekendNotify: schoolWeekend,
      setWeekendNotify: setSchoolWeekend,
      soundFile: soundSchool,
      deletable: false,
    })
    if (hasSchool) {
      rows.push({
        rowId: 'return',
        label: '하원·귀가',
        minutes: minutesFromHHMM(returnHomeTime),
        time: returnHomeTime,
        setTime: setReturnHomeTime,
        weekdayNotify: notifyReturn,
        setWeekdayNotify: setNotifyReturn,
        weekendNotify: returnOnWeekend,
        setWeekendNotify: setReturnOnWeekend,
        soundFile: soundReturn,
        deletable: false,
      })
    }
    rows.push({
      rowId: 'sleepReady',
      label: '잘 준비',
      minutes: minutesFromHHMM(sleepReadyTime),
      time: sleepReadyTime,
      setTime: setSleepReadyTime,
      weekdayNotify: sleepReadyWeekday,
      setWeekdayNotify: setSleepReadyWeekday,
      weekendNotify: sleepReadyWeekend,
      setWeekendNotify: setSleepReadyWeekend,
      soundFile: soundSleepReady,
      deletable: false,
    })
    rows.push({
      rowId: 'sleep',
      label: '잘 시간',
      minutes: minutesFromHHMM(sleepTime),
      time: sleepTime,
      setTime: setSleepTime,
      weekdayNotify: notifySleep,
      setWeekdayNotify: setNotifySleep,
      weekendNotify: sleepOnWeekend,
      setWeekendNotify: setSleepOnWeekend,
      soundFile: soundSleep,
      deletable: false,
    })
    for (const c of customAlarms) {
      const wkEnd = c.onWeekend !== false
      rows.push({
        rowId: c.id,
        label: c.label,
        minutes: minutesFromHHMM(c.time),
        time: c.time,
        setTime: (t) => setCustomAlarms((prev) => prev.map((x) => (x.id === c.id ? { ...x, time: t } : x))),
        weekdayNotify: c.notify,
        setWeekdayNotify: (v) => setCustomAlarms((prev) => prev.map((x) => (x.id === c.id ? { ...x, notify: v } : x))),
        weekendNotify: wkEnd,
        setWeekendNotify: (v) => setCustomAlarms((prev) => prev.map((x) => (x.id === c.id ? { ...x, onWeekend: v } : x))),
        soundFile: c.soundFile,
        deletable: true,
      })
    }
    rows.sort((a, b) => a.minutes - b.minutes || sortRowTie(a.rowId).localeCompare(sortRowTie(b.rowId)))
    return rows
  }, [
    wakeTime,
    schoolTime,
    returnHomeTime,
    sleepReadyTime,
    sleepTime,
    hasSchool,
    notifyWake,
    notifyReturn,
    notifySleep,
    schoolWeekday,
    schoolWeekend,
    sleepReadyWeekday,
    sleepReadyWeekend,
    wakeOnWeekend,
    returnOnWeekend,
    sleepOnWeekend,
    soundWake,
    soundSchool,
    soundReturn,
    soundSleepReady,
    soundSleep,
    customAlarms,
  ])

  async function createMissionsFromIds(
    amIds: string[],
    pmIds: string[],
    repeatType: 'daily' | 'weekly',
    options: { hasSchoolForAnchor: boolean; linkedChildId: string | null },
    customs: RoutineCustomAlarmStored[],
  ) {
    /** 풀 정의 순서대로 미션 생성 (가로 스크롤 순서와 동일) */
    const ordered: ChipDef[] = [...AM_CHIPS.filter((c) => amIds.includes(c.id)), ...PM_CHIPS.filter((c) => pmIds.includes(c.id))]

    for (const chip of ordered) {
      const time = scheduledTimeForChip(chip, {
        selPmIds: pmIds,
        wake: wakeTime,
        sleep: sleepTime,
        schoolTime,
        returnAnchor,
        hasSchool: options.hasSchoolForAnchor,
        notifyWake,
        notifyReturn,
        notifySleep,
        schoolWeekday,
        schoolWeekend,
      })
      const description = missionDescriptionForChip(
        chip,
        pmIds,
        soundWake,
        soundSchool,
        soundReturn,
        soundSleep,
        options.hasSchoolForAnchor,
      )
      const res = await fetch('/api/mission/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: chip.title,
          description,
          icon_emoji: routineMissionIconEmojiForCreate(chip.title),
          block: chip.apiBlock,
          scheduled_time: time,
          credit_reward: 10,
          exp_reward: 10,
          heart_reward: 1,
          difficulty: 'easy',
          repeat_type: repeatType,
          level_required: 0,
          ...(options.linkedChildId ? { linked_child_id: options.linkedChildId } : {}),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? '미션 생성 실패')
      }
    }

    /** 평일(daily)에만 사용자 추가 알람 미션을 붙임 — 휴일 weekly 칩과 중복 방지 */
    if (repeatType === 'daily' && customs.length > 0) {
      const sortedCustom = [...customs].sort(
        (a, b) => minutesFromHHMM(a.time) - minutesFromHHMM(b.time) || a.id.localeCompare(b.id),
      )
      for (const a of sortedCustom) {
        const t = a.notify && /^\d{2}:\d{2}$/.test(a.time) ? a.time : null
        const block = blockFromTimeHHMM(a.time)
        const description = alarmDescription(a.soundFile)
        const res = await fetch('/api/mission/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: a.label.trim(),
            description,
            icon_emoji: '·',
            block,
            scheduled_time: t,
            credit_reward: 10,
            exp_reward: 10,
            heart_reward: 1,
            difficulty: 'easy',
            repeat_type: 'daily',
            level_required: 0,
            ...(options.linkedChildId ? { linked_child_id: options.linkedChildId } : {}),
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? '미션 생성 실패')
        }
      }
    }
  }

  /** 휴일을 평일과 같게 / 따로 — 인자로 받아 상태 비동기 문제를 피함 */
  async function finishRoutine(mode: 'weekdayOnly' | 'withCustomHoliday') {
    setSubmitting(true)
    setError(null)
    try {
      // 1단계에서 고른 연령대·보육 형태를 DB에 남겨 부모 홈/루틴 카드에 그대로 보이게 합니다.
      if (linkedChildId) {
        const res = await fetch('/api/child/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId: linkedChildId,
            ageGroup,
            institutionType,
            /** 휴일 루틴: 주말 백필이 daily 가 아닌 weekly/빈 풀을 쓰도록 `profiles` 에도 기록 */
            holidayRoutineMode: mode === 'withCustomHoliday' ? 'custom' : 'as_weekday',
          }),
        })
        const text = await res.text()
        let j: { error?: string } = {}
        try {
          j = text ? (JSON.parse(text) as { error?: string }) : {}
        } catch {
          j = {}
        }
        if (!res.ok) {
          throw new Error(
            typeof j.error === 'string' && j.error.trim()
              ? j.error
              : text?.trim()?.slice(0, 280) || `연령·보육 정보 저장 요청 오류 (${res.status})`,
          )
        }
      }

      await createMissionsFromIds(weekdayAm, weekdayPm, 'daily', { hasSchoolForAnchor: hasSchool, linkedChildId }, customAlarms)
      if (mode === 'withCustomHoliday') {
        await createMissionsFromIds(holidayAm, holidayPm, 'weekly', { hasSchoolForAnchor: false, linkedChildId }, [])
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('cooanc_routine_has_school', hasSchool ? '1' : '0')
        writeRoutineAlarmPrefs({
          notifyWake,
          notifyReturn,
          notifySleep,
          wakeTime,
          returnHomeTime,
          sleepTime,
          soundWake,
          soundReturn,
          soundSleep,
          customAlarms,
          wakeOnWeekend,
          returnOnWeekend,
          sleepOnWeekend,
          sleepReadyTime,
          soundSleepReady,
          sleepReadyEnabled: sleepReadyWeekday || sleepReadyWeekend,
          sleepReadyWeekday,
          sleepReadyWeekend,
          schoolTime,
          soundSchool,
          schoolEnabled: schoolWeekday || schoolWeekend,
          schoolWeekday,
          schoolWeekend,
        })
      }

      /** 등원·잘 준비 시각은 부모 루틴 알람 시트와 같이 DB child_stats 에도 남김 */
      if (linkedChildId) {
        const supabase = createClient()
        const schoolEnabledOut = schoolWeekday || schoolWeekend
        const sleepReadyEnabledOut = sleepReadyWeekday || sleepReadyWeekend
        const { error: statsErr } = await supabase
          .from('child_stats')
          .update({
            school_time: schoolTime,
            school_time_enabled: schoolEnabledOut,
            school_time_weekday: schoolWeekday,
            school_time_weekend: schoolWeekend,
            sleep_ready_time: sleepReadyTime,
            sleep_ready_time_enabled: sleepReadyEnabledOut,
            sleep_ready_time_weekday: sleepReadyWeekday,
            sleep_ready_time_weekend: sleepReadyWeekend,
          })
          .eq('child_id', linkedChildId)
        if (statsErr) {
          console.warn('[onboarding routine] 등원·잘 준비 알람 child_stats 저장 실패:', statsErr.message)
        }
      }
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : '미션 생성 중 오류가 발생했어요.')
      setSubmitting(false)
    }
  }

  const totalSteps = 2

  if (submitting) {
    return (
      <Shell step={2} total={totalSteps}>
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand-blue border-t-transparent" aria-hidden />
          <p className="text-sm font-bold text-brand-text">루틴을 만들고 있어요…</p>
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 text-center">{error}</p>}
        </div>
      </Shell>
    )
  }

  // ── Step 1 (제목 없음 — 상단 페이지에서 「초기 루틴 설정」만 표시)
  if (step === 1) {
    return (
      <Shell step={1} total={totalSteps}>
        <div className="flex flex-col gap-2.5">
          <div>
            <p className="text-[11px] font-bold text-gray-500 mb-1">연령대</p>
            <div className="flex gap-1.5">
              {(
                [
                  ['preschool', '미취학', '7세 미만'],
                  ['school', '학령기', '초등 이상'],
                ] as const
              ).map(([v, l, s]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAgeGroup(v)}
                  className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                    ageGroup === v ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {l}
                  <span className="block text-[10px] font-normal leading-tight">{s}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-gray-500 mb-1">보육 형태</p>
            <div
              className={`grid gap-1.5 ${ageGroup === 'preschool' ? 'grid-cols-3' : 'grid-cols-2'}`}
            >
              {(ageGroup === 'preschool'
                ? ([
                    ['home', '가정보육'],
                    ['daycare', '어린이집'],
                    ['kindergarten', '유치원'],
                  ] as const)
                : ([
                    ['school', '학교'],
                    ['home', '홈스쿨'],
                  ] as const)
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setInstitutionType(v as InstitutionType)}
                  className={`py-2 rounded-lg border-2 text-xs font-bold transition-all ${
                    institutionType === v ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-white px-2 py-1.5 shadow-sm border border-gray-100">
            {/*
              1행: 제목 한 줄 + 열 너비 w-8에 +, w-9에 휴지통(삭제 모드는 제목 옆에 취소·선택 삭제)
              2행: 데이터 행과 맞춤 — 「소리」「주중」「주말」(부모 루틴 알람 시트와 동일)
            */}
            <div className="mb-0.5 flex flex-col gap-0.5 border-b border-gray-200 pb-1">
              <div className="flex items-center gap-1">
                {alarmDeleteMode && customAlarms.length > 0 ? <div className="w-5 shrink-0" aria-hidden /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-bold text-gray-600" title="일정별 알람 설정">
                    일정별 알람 설정
                  </p>
                  {alarmDeleteMode ? (
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={cancelAlarmDeleteMode}
                        className="rounded-md px-2 py-0.5 text-[9px] font-bold text-gray-500 hover:bg-gray-100"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={confirmAlarmDeleteSelected}
                        disabled={selectedAlarmDeleteIds.size === 0}
                        className="rounded-md px-2 py-0.5 text-[9px] font-bold text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        선택 삭제 ({selectedAlarmDeleteIds.size})
                      </button>
                    </div>
                  ) : null}
                </div>
                {!alarmDeleteMode ? (
                  <>
                    <div className="flex w-8 shrink-0 items-center justify-center">
                      <PlainPlusButton onClick={openAddSheet} aria-label="알람 일정 추가" />
                    </div>
                    <div className="flex w-9 shrink-0 items-center justify-center">
                      <TrashIconButton
                        onClick={onTrashAlarmClick}
                        disabled={customAlarms.length === 0}
                        active={alarmDeleteMode}
                        aria-label={alarmDeleteMode ? '삭제 모드 끄기' : '일정 선택 삭제'}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 shrink-0" aria-hidden />
                    <div className="w-9 shrink-0" aria-hidden />
                  </>
                )}
              </div>
              <div className="flex items-end gap-1">
                {alarmDeleteMode && customAlarms.length > 0 ? (
                  <div className="flex w-5 shrink-0 items-end justify-center pb-0.5">
                    <span className="text-center text-[7px] font-bold leading-tight text-gray-500">선택</span>
                  </div>
                ) : null}
                <div className="w-[4.5rem] shrink-0" aria-hidden />
                <div className="min-w-0 flex-1" aria-hidden />
                <div className="flex w-8 shrink-0 items-end justify-center pb-0.5">
                  <span className="text-center text-[8px] font-bold text-gray-500">소리</span>
                </div>
                <div className="flex w-[3.65rem] shrink-0 items-end justify-center gap-0.5 pb-0.5">
                  <span className="flex w-7 justify-end text-[7px] font-bold leading-none text-gray-500">주중</span>
                  <span className="flex w-7 justify-end text-[7px] font-bold leading-none text-gray-500">주말</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              {sortedAlarmRows.map((row) => (
                <AlarmScheduleRow
                  key={row.rowId}
                  label={row.label}
                  time={row.time}
                  onTimeChange={row.setTime}
                  weekdayNotify={row.weekdayNotify}
                  onWeekdayNotifyChange={row.setWeekdayNotify}
                  weekendNotify={row.weekendNotify}
                  onWeekendNotifyChange={row.setWeekendNotify}
                  soundTitle={soundLabel(row.soundFile)}
                  onPickSound={() => openSoundSheet(row.rowId)}
                  deleteMode={alarmDeleteMode}
                  deletable={row.deletable}
                  deleteSelected={selectedAlarmDeleteIds.has(row.rowId)}
                  onDeleteSelectToggle={() => toggleAlarmDeleteSelect(row.rowId)}
                />
              ))}
            </div>
            {!hasSchool ? (
              <p className="mt-1.5 px-1 text-[10px] leading-snug text-gray-400">
                가정보육으로 설정된 경우 하원·귀가 알람은 쓰지 않아요. (등원 알람만 계속 설정할 수 있어요.)
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              setAlarmDeleteMode(false)
              setSelectedAlarmDeleteIds(new Set())
              setStep(2)
            }}
            className="w-full rounded-xl bg-brand-blue py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.99]"
          >
            다음
          </button>
        </div>

        {sheet.open && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end" role="presentation">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="닫기"
              onClick={() => setSheet({ open: false })}
            />
            <div className="relative max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-6 pt-3 shadow-xl">
              {sheet.mode === 'add' && (
                <>
                  <p className="text-center text-sm font-black text-brand-text mb-3">알람 일정 추가</p>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">일정 이름</label>
                  <input
                    value={sheetLabel}
                    onChange={(e) => setSheetLabel(e.target.value)}
                    placeholder="예: 학원 가기, 독서 시간"
                    className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
                  />
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">시각</label>
                  <AddSheetTimeRow value={sheetTime} onChange={setSheetTime} />
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-600">알림 사용</span>
                    <NotifyToggleSmall notify={sheetNotify} onToggle={() => setSheetNotify((n) => !n)} />
                  </div>
                  <p className="text-[10px] font-bold text-gray-500 mb-0.5">알람 소리</p>
                  <div className="mb-1.5 flex justify-end">
                    <button
                      type="button"
                      onClick={stopAlarmPreview}
                      disabled={!alarmPreviewPlayingId}
                      className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-gray-600 transition-colors enabled:hover:bg-gray-100 enabled:active:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      소리 끄기
                    </button>
                  </div>
                  <RoutineAlarmSoundToggleList
                    sounds={alarmSounds}
                    selectedId={sheetSound}
                    onSelect={(id) => {
                      setSheetSound(id)
                      const u = alarmSounds.find((s) => s.id === id)?.url
                      if (u) alarmPreviewPlay(u, id)
                    }}
                    onPreview={alarmPreviewPlay}
                    onStop={stopAlarmPreview}
                    playingId={alarmPreviewPlayingId}
                    accent="routineBlue"
                    emphasizeCategoryBlocks
                    listMaxHeightClass="max-h-72"
                  />
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSheet({ open: false })}
                      className="flex-1 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-600"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={submitAddSheet}
                      disabled={!sheetLabel.trim()}
                      className="flex-1 rounded-xl bg-brand-blue py-2.5 text-xs font-bold text-white disabled:opacity-40"
                    >
                      추가
                    </button>
                  </div>
                </>
              )}
              {sheet.mode === 'sound' && (
                <>
                  <p className="text-center text-sm font-black text-brand-text mb-1">알람 소리 선택</p>
                  <div className="mb-2 flex justify-end">
                    <button
                      type="button"
                      onClick={stopAlarmPreview}
                      disabled={!alarmPreviewPlayingId}
                      className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-gray-600 transition-colors enabled:hover:bg-gray-100 enabled:active:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      소리 끄기
                    </button>
                  </div>
                  <RoutineAlarmSoundToggleList
                    sounds={soundsForSoundSheetPicker}
                    selectedId={pickerSound}
                    onSelect={(id) => {
                      setPickerSound(id)
                      const u = soundsForSoundSheetPicker.find((s) => s.id === id)?.url
                      if (u) alarmPreviewPlay(u, id)
                    }}
                    onPreview={alarmPreviewPlay}
                    onStop={stopAlarmPreview}
                    playingId={alarmPreviewPlayingId}
                    accent="routineBlue"
                    emphasizeCategoryBlocks
                    listMaxHeightClass={
                      sheet.open && sheet.mode === 'sound' && sheet.rowId === 'sleep' ? 'max-h-80' : 'max-h-72'
                    }
                  />
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSheet({ open: false })}
                      className="flex-1 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-600"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={applyPickerSound}
                      className="flex-1 rounded-xl bg-brand-blue py-2.5 text-xs font-bold text-white"
                    >
                      적용
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Shell>
    )
  }

  // ── Step 2: 평일·휴일 루틴을 한 화면에서 설정
  if (step === 2) {
    return (
      <>
        {/* 상단 「루틴 설정」 제목 없음 — 페이지는 「초기 루틴 설정」만 상위에서 표시 */}
        <Shell step={2} total={totalSteps} onBack={() => setStep(1)}>
          {/* 평일·휴일 소제목은 왼쪽, 본문 설명도 왼쪽 */}
          <div className="flex w-full flex-col gap-2 text-left">
            <p className="text-xs font-black text-brand-text -mt-1 mb-0">평일 루틴</p>
            <p className="text-[10px] text-gray-400 -mt-1 mb-0 leading-snug">일상속 루틴을 선택해 보세요.</p>
            <BlockSection label="오전">
              <HorizontalChips
                pool={AM_CHIPS}
                selectedIds={weekdayAm}
                hasSchool={hasSchool}
                onToggle={(id, fixed) => setWeekdayAm((prev) => toggleChipId(AM_CHIPS, prev, id, fixed))}
              />
            </BlockSection>
            <BlockSection label="오후·저녁">
              <HorizontalChips
                pool={PM_CHIPS}
                selectedIds={weekdayPm}
                hasSchool={hasSchool}
                onToggle={(id, fixed) => setWeekdayPm((prev) => toggleChipId(PM_CHIPS, prev, id, fixed))}
              />
            </BlockSection>

            {/* 휴일: 두 옵션을 한 줄 — 「휴일은 달라요」일 때만 아래 휴일 오전·오후 칩 표시 */}
            <p className="text-xs font-black text-brand-text pt-1">휴일 루틴</p>
            <div className="grid grid-cols-2 gap-2">
              <HolidayModeOption
                label="평일과 같아요"
                sub="바로 적용하고 시작"
                selected={holidayRoutineMode === 'as_weekday'}
                onClick={() => setHolidayRoutineMode('as_weekday')}
              />
              <HolidayModeOption
                label="휴일은 달라요"
                sub="오전·오후 키워드 다시 선택"
                selected={holidayRoutineMode === 'custom'}
                onClick={() => setHolidayRoutineMode('custom')}
              />
            </div>

            {holidayRoutineMode === 'custom' ? (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-gray-400 leading-snug">등원 등 평일 항목은 휴일 목록에 나오지 않아요.</p>
                <BlockSection label="오전 (휴일)">
                  <HorizontalChips
                    pool={AM_CHIPS}
                    selectedIds={holidayAm}
                    hasSchool={false}
                    onToggle={(id, fixed) => setHolidayAm((prev) => toggleChipId(AM_CHIPS, prev, id, fixed))}
                  />
                </BlockSection>
                <BlockSection label="오후·저녁 (휴일)">
                  <HorizontalChips
                    pool={PM_CHIPS}
                    selectedIds={holidayPm}
                    hasSchool={false}
                    onToggle={(id, fixed) => setHolidayPm((prev) => toggleChipId(PM_CHIPS, prev, id, fixed))}
                  />
                </BlockSection>
              </div>
            ) : null}

            {error && !submitting ? (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 text-left">{error}</p>
            ) : null}

            <button
              type="button"
              onClick={() =>
                void finishRoutine(holidayRoutineMode === 'custom' ? 'withCustomHoliday' : 'weekdayOnly')
              }
              className="w-full rounded-xl bg-brand-green py-3 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.99]"
            >
              루틴 시작하기
            </button>
            {/* 예전 「나중에 수정할게요」 자리 — 짧은 링크로 시트만 엶 (중앙 정렬) */}
            <button
              type="button"
              onClick={() => {
                setSuggestSubmitMsg(null)
                setMissionSuggestOpen(true)
              }}
              className="w-full text-center text-[11px] font-bold text-gray-400 underline underline-offset-2 decoration-gray-300 hover:text-brand-blue hover:decoration-brand-blue/50"
            >
              [미션 추가 제안]
            </button>
          </div>
        </Shell>

        {missionSuggestOpen ? (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end" role="dialog" aria-modal="true" aria-labelledby="mission-suggest-title">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="닫기"
              onClick={() => setMissionSuggestOpen(false)}
            />
            <div className="relative max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-6 pt-3 shadow-xl">
              <p id="mission-suggest-title" className="text-left text-sm font-black text-brand-text mb-1">
                미션 추가 제안하기
              </p>
              <p className="text-[10px] text-gray-500 mb-3 text-left leading-snug">
                목록에 없는 루틴을 적어 주세요. 제안은 검토 후 반영될 수 있어요. (이메일 자동 전달은 곧 연결할 예정이에요.)
              </p>
              <label className="block text-[10px] font-bold text-gray-500 mb-1">추가하고 싶은 미션</label>
              <input
                value={suggestMissionTitle}
                onChange={(e) => setSuggestMissionTitle(e.target.value)}
                placeholder="예: 피아노 연습, 반려견 산책"
                maxLength={200}
                className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
              />
              <label className="block text-[10px] font-bold text-gray-500 mb-1">자유 입력 (선택)</label>
              <textarea
                value={suggestMissionDetail}
                onChange={(e) => setSuggestMissionDetail(e.target.value)}
                placeholder="시간대, 아이 연령, 하고 싶은 방식 등을 적어 주세요."
                rows={4}
                maxLength={1800}
                className="mb-2 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
              />
              {suggestSubmitMsg ? <p className="mb-2 text-xs text-red-500">{suggestSubmitMsg}</p> : null}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={suggestSubmitting}
                  onClick={() => setMissionSuggestOpen(false)}
                  className="flex-1 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-600"
                >
                  닫기
                </button>
                <button
                  type="button"
                  disabled={suggestSubmitting}
                  onClick={() => void submitMissionSuggestion()}
                  className="flex-1 rounded-xl bg-brand-blue py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {suggestSubmitting ? '보내는 중…' : '제안 보내기'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    )
  }

  return null
}

/** 시계 아이콘 (SVG) — 시간 선택 버튼에 사용 */
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 알람 소리 선택 버튼용 음표 아이콘 */
function MusicNoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  )
}

/** 일정별 알람 헤더용 — 원/테두리 없이 + 만 */
function PlainPlusButton({ onClick, 'aria-label': ariaLabel }: { onClick: () => void; 'aria-label': string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="-mr-1 flex h-8 min-w-[2rem] items-center justify-center rounded-md text-2xl font-light leading-none text-brand-blue hover:bg-brand-blue/10"
    >
      +
    </button>
  )
}

/** 쓰레기통 — 추가된 일정이 있을 때만 활성, 삭제 모드 시 강조 */
function TrashIconButton({
  onClick,
  disabled,
  active,
  'aria-label': ariaLabel,
}: {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  'aria-label': string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={[
        'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
        disabled ? 'cursor-not-allowed text-gray-300' : active ? 'bg-red-50 text-red-500' : 'text-gray-500 hover:bg-gray-100 hover:text-red-500',
      ].join(' ')}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M3 6h18M8 6V4h8v2m-9 4v10a2 2 0 002 2h6a2 2 0 002-2V10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 11v6M14 11v6" strokeLinecap="round" />
      </svg>
    </button>
  )
}

/** 알람 추가 시트 — 시계 아이콘 하나만(네이티브 중복 아이콘 숨김) */
function AddSheetTimeRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const timeInputRef = useRef<HTMLInputElement>(null)

  const openTimePicker = () => {
    const el = timeInputRef.current
    if (!el) return
    const withPicker = el as HTMLInputElement & { showPicker?: () => void }
    if (typeof withPicker.showPicker === 'function') {
      try {
        withPicker.showPicker()
        return
      } catch {
        /* ignore */
      }
    }
    el.focus()
    el.click()
  }

  return (
    <div className="mb-3 flex items-center gap-1">
      <button
        type="button"
        onClick={openTimePicker}
        className="shrink-0 rounded-md p-0.5 text-gray-500 hover:bg-gray-100 hover:text-brand-blue"
        aria-label="시간 선택"
      >
        <ClockIcon className="h-4 w-4" />
      </button>
      <input
        ref={timeInputRef}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="relative z-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-bold text-brand-text [color-scheme:light] focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
      />
    </div>
  )
}

function NotifyToggleSmall({ notify, onToggle }: { notify: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-all ${notify ? 'bg-brand-blue' : 'bg-gray-200'}`}
      aria-pressed={notify}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${notify ? 'left-4' : 'left-0.5'}`} />
    </button>
  )
}

/**
 * 미니 스위치: 부모 루틴 알람 시트 NotifyToggleSmall / WeekendMiniToggle 과 같은 크기(주중·주말 열)
 */
function RoutineAlarmMiniToggle({
  on,
  onToggle,
  ariaLabel,
}: {
  on: boolean
  onToggle: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative h-3.5 w-7 shrink-0 rounded-full transition-all ${on ? 'bg-brand-blue' : 'bg-gray-200'}`}
      aria-pressed={on}
      aria-label={ariaLabel}
    >
      <span
        className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-all ${on ? 'left-3.5' : 'left-0.5'}`}
      />
    </button>
  )
}

/**
 * 일정별 알람 한 줄 — 시계는 하나만(클릭 시 시간 선택), 부모 앱과 같이 「주중」「주말」 별도 토글 + 소리
 */
function AlarmScheduleRow({
  label,
  time,
  onTimeChange,
  weekdayNotify,
  onWeekdayNotifyChange,
  weekendNotify,
  onWeekendNotifyChange,
  soundTitle,
  onPickSound,
  deleteMode,
  deletable,
  deleteSelected,
  onDeleteSelectToggle,
}: {
  label: string
  time: string
  onTimeChange: (t: string) => void
  weekdayNotify: boolean
  onWeekdayNotifyChange: (v: boolean) => void
  weekendNotify: boolean
  onWeekendNotifyChange: (v: boolean) => void
  soundTitle: string
  onPickSound: () => void
  deleteMode?: boolean
  deletable?: boolean
  deleteSelected?: boolean
  onDeleteSelectToggle?: () => void
}) {
  const timeInputRef = useRef<HTMLInputElement>(null)

  const openTimePicker = () => {
    const el = timeInputRef.current
    if (!el) return
    const withPicker = el as HTMLInputElement & { showPicker?: () => void }
    if (typeof withPicker.showPicker === 'function') {
      try {
        withPicker.showPicker()
        return
      } catch {
        /* 일부 브라우저는 showPicker 실패 가능 */
      }
    }
    el.focus()
    el.click()
  }

  const showSelectCol = Boolean(deleteMode)

  return (
    <div className="flex items-center gap-1 border-b border-gray-100 py-1.5 last:border-b-0">
      {showSelectCol ? (
        <div className="flex w-5 shrink-0 items-center justify-center">
          {deletable ? (
            <input
              type="checkbox"
              checked={Boolean(deleteSelected)}
              onChange={() => onDeleteSelectToggle?.()}
              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
              aria-label={`${label} 삭제 대상 선택`}
            />
          ) : (
            <span className="block w-3.5" aria-hidden />
          )}
        </div>
      ) : null}
      <span className="w-[4.5rem] shrink-0 truncate text-[11px] font-bold text-gray-700" title={label}>
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <button
          type="button"
          onClick={openTimePicker}
          className="shrink-0 rounded-md p-0.5 text-gray-500 hover:bg-gray-100 hover:text-brand-blue"
          aria-label={`${label} 시간 선택`}
        >
          <ClockIcon className="h-4 w-4" />
        </button>
        <input
          ref={timeInputRef}
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          className="relative z-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-xs font-bold text-brand-text [color-scheme:light] focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
        />
      </div>
      <button
        type="button"
        onClick={onPickSound}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-brand-blue hover:bg-brand-blue/10"
        title={soundTitle}
        aria-label={`알람 소리: ${soundTitle}`}
      >
        <MusicNoteIcon className="h-4 w-4" />
      </button>
      {/* 주중 열은 평일에 울림 여부, 주말 열은 주말에도 같은 알람을 재생할지(부모 RoutineAlarmSettingsSheet 와 동일) */}
      <div className="flex w-[3.65rem] shrink-0 items-center justify-end gap-0.5">
        <div className="flex w-7 justify-end">
          <RoutineAlarmMiniToggle
            on={weekdayNotify}
            onToggle={() => onWeekdayNotifyChange(!weekdayNotify)}
            ariaLabel={`${label} 주중`}
          />
        </div>
        <div className="flex w-7 justify-end">
          <RoutineAlarmMiniToggle
            on={weekendNotify}
            onToggle={() => onWeekendNotifyChange(!weekendNotify)}
            ariaLabel={`${label} 주말`}
          />
        </div>
      </div>
    </div>
  )
}

function HorizontalChips({
  pool,
  selectedIds,
  hasSchool,
  onToggle,
}: {
  pool: ChipDef[]
  selectedIds: string[]
  hasSchool: boolean
  onToggle: (id: string, isFixed: boolean) => void
}) {
  const setSel = new Set(selectedIds)
  const visible = pool.filter((c) => !c.hideWhenNoSchool || hasSchool)

  return (
    <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
      <div className="flex w-max min-w-full gap-2 px-1 snap-x snap-mandatory">
        {visible.map((chip) => {
          const selected = setSel.has(chip.id)
          const isFixed = chip.type === 'fixed'
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onToggle(chip.id, isFixed)}
              className={[
                'snap-start shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-all whitespace-nowrap',
                isFixed ? 'border-brand-blue bg-brand-blue/10 text-brand-blue cursor-default' : selected ? 'border-brand-green bg-brand-green/10 text-brand-green' : 'border-gray-200 text-gray-400',
              ].join(' ')}
            >
              {/* 칩에는 활동 이름만 표시(고정·추천 배지는 제거) */}
              <span>{chip.title}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Shell({
  step,
  total,
  title,
  titleAlign = 'center',
  children,
  onBack,
}: {
  step: number
  total: number
  title?: string
  /** 루틴 설정 등에서 페이지 제목을 왼쪽에 맞출 때 사용 */
  titleAlign?: 'left' | 'center'
  children: React.ReactNode
  onBack?: () => void
}) {
  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {onBack && (
          <button type="button" onClick={onBack} className="text-brand-blue text-xs font-bold shrink-0">
            이전
          </button>
        )}
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-blue to-brand-green rounded-full transition-all duration-500"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-400 font-bold w-7 text-right shrink-0 tabular-nums">
          {step}/{total}
        </span>
      </div>
      {title ? (
        <h2
          className={`text-sm font-black text-brand-text leading-tight w-full ${
            titleAlign === 'left' ? 'text-left' : 'text-center'
          }`}
        >
          {title}
        </h2>
      ) : null}
      {children}
    </div>
  )
}

function BlockSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-2.5 shadow-sm border border-gray-100">
      <p className="text-xs font-black text-brand-text mb-1.5">{label}</p>
      {children}
    </div>
  )
}

/**
 * 휴일 루틴 모드 선택 — 한 줄 두 칸용. 선택된 쪽은 파란 테두리로 표시
 */
function HolidayModeOption({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string
  sub?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'min-w-0 rounded-xl bg-white px-2.5 py-2 shadow-sm border text-center transition-all active:scale-[0.99]',
        selected ? 'border-brand-blue ring-1 ring-brand-blue/25' : 'border-gray-100 hover:border-brand-blue/30',
      ].join(' ')}
    >
      <p className="text-[11px] font-bold text-brand-text leading-tight">{label}</p>
      {sub ? <p className="text-[9px] text-gray-400 mt-1 leading-snug">{sub}</p> : null}
    </button>
  )
}
