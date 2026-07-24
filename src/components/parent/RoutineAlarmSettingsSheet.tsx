'use client'

/**
 * 부모 「루틴 알람 설정」전용 시트 — 알람시계(alarm.png) 느낌의 생활 알람만 다룹니다.
 * - 알림·공지는 상단 `notice.png` 버튼의 ParentBellBoardSheet 를 씁니다(루틴 설정은 알람시계 버튼만).
 * - 온보딩과 동일한 기상·등원·하원·귀가·잘 준비·잘 시간 + 추가 일정, 우측 + 로 추가, 행마다 삭제 가능
 * - 등원·잘 준비는 child_stats 에 시각·주중/주말·(주중|주말 중 하나라도 켜면 true 인) 사용 여부를 저장합니다.
 */

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useAlarmSoundPreview } from '@/hooks/useAlarmSoundPreview'
import { createPortal } from 'react-dom'
import {
  readRoutineAlarmPrefs,
  readRoutineHasSchoolFromStorage,
  writeRoutineAlarmPrefs,
  serializeRoutineAlarmStorage,
  type RoutineAlarmPrefsLoaded,
  type RoutineCustomAlarmStored,
} from '@/lib/routineAlarmLocalPrefs'
import { createClient } from '@/lib/supabase/client'
import { useParentStore } from '@/store/parentStore'
import { mergeRoutineAlarmPickListFromApi } from '@/lib/routineAlarmSounds'
import { parseJsonFromResponse } from '@/lib/parseJsonResponse'
import RoutineAlarmSoundToggleList, {
  type AlarmSoundPickRow,
} from '@/components/common/RoutineAlarmSoundToggleList'

type SoundItem = AlarmSoundPickRow

/** 기본 루틴 알람 행 — 라벨·행 키·저장값이 없을 때 쓸 defaultSoundId (soundId = prefs ?? defaultSoundId) */
type CoreRoutineRowKey = 'wake' | 'return' | 'sleep' | 'school' | 'sleepReady'

const CORE_ROUTINE_ALARM_ITEMS: Array<{
  row: CoreRoutineRowKey
  label: string
  defaultSoundId: string
}> = [
  { row: 'wake', label: '기상', defaultSoundId: 'morning_greet' },
  { row: 'school', label: '등원', defaultSoundId: 'time_to_go' },
  { row: 'return', label: '하원·귀가', defaultSoundId: 'tick_tock_timer' },
  { row: 'sleepReady', label: '잘 준비', defaultSoundId: 'sleep_ready' },
  { row: 'sleep', label: '잘 시간', defaultSoundId: 'sleep_time_alert' },
]

/** 행 키 → 기본 소리 id (API 목록 로드 후에도 prefs 가 비었을 때 폴백) */
const CORE_DEFAULT_SOUND_BY_ROW: Record<CoreRoutineRowKey, string> = CORE_ROUTINE_ALARM_ITEMS.reduce(
  (acc, item) => {
    acc[item.row] = item.defaultSoundId
    return acc
  },
  {} as Record<CoreRoutineRowKey, string>,
)

type SoundPickTarget =
  | { type: 'core'; row: 'wake' | 'return' | 'sleep' | 'school' | 'sleepReady' }
  | { type: 'custom'; index: number }

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * 기본 루틴 알람 카드 — 데이터·헤더 줄 공통 그리드(3열)
 * - 1열 auto: 라벨+시간(왼쪽)
 * - 2열 1fr: 가운데 빈 여백(소리·주중·주말을 오른쪽으로 몰아 줌)
 * - 3열 auto: 소리·주중·주말을 한 줄에 `justify-end`로 묶은 영역(+와 같은 쪽)
 */
const ROUTINE_ALARM_CARD_GRID = 'grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2'

/** 소리 / 주중 / 주말(옵션 삭제)을 오른쪽 끝으로 붙이는 가로 묶음 */
const ROUTINE_ALARM_RIGHT_CLUSTER = 'flex shrink-0 items-center justify-end gap-0.5'

export default function RoutineAlarmSettingsSheet({ open, onClose }: Props) {
  const selectedChildId = useParentStore((s) => s.selectedChildId)
  const [hasSchool, setHasSchool] = useState(true)
  const [wakeTime, setWakeTime] = useState('07:00')
  const [sleepTime, setSleepTime] = useState('21:00')
  const [returnHomeTime, setReturnHomeTime] = useState('15:00')
  const [notifyWake, setNotifyWake] = useState(true)
  const [notifyReturn, setNotifyReturn] = useState(true)
  const [notifySleep, setNotifySleep] = useState(true)
  const [wakeOnWeekend, setWakeOnWeekend] = useState(true)
  const [returnOnWeekend, setReturnOnWeekend] = useState(true)
  const [sleepOnWeekend, setSleepOnWeekend] = useState(true)
  const [soundWake, setSoundWake] = useState('')
  const [soundReturn, setSoundReturn] = useState('')
  const [soundSleep, setSoundSleep] = useState('')
  const [soundSchool, setSoundSchool] = useState('')
  const [soundSleepReady, setSoundSleepReady] = useState('')
  /** 등원 알람 — child_stats.school_time* 과 동기화 (전체 사용 여부는 주중·주말 중 하나라도 켜면 true 로 저장) */
  const [schoolTime, setSchoolTime] = useState('08:30')
  const [schoolWeekday, setSchoolWeekday] = useState(true)
  const [schoolWeekend, setSchoolWeekend] = useState(true)
  /** 잘 준비 알람 — child_stats.sleep_ready_time* 과 동기화 */
  const [sleepReadyTime, setSleepReadyTime] = useState('20:30')
  const [sleepReadyWeekday, setSleepReadyWeekday] = useState(true)
  const [sleepReadyWeekend, setSleepReadyWeekend] = useState(true)
  const [customAlarms, setCustomAlarms] = useState<RoutineCustomAlarmStored[]>([])
  const [alarmSounds, setAlarmSounds] = useState<SoundItem[]>([])
  const [soundSheet, setSoundSheet] = useState<{ open: false } | { open: true; target: SoundPickTarget }>({
    open: false,
  })
  const [pickerSound, setPickerSound] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addLabel, setAddLabel] = useState('')
  const [addTime, setAddTime] = useState('12:00')
  const [addNotify, setAddNotify] = useState(true)
  const [addSound, setAddSound] = useState('')
  const [portalReady, setPortalReady] = useState(false)
  const [sheetEntered, setSheetEntered] = useState(false)
  /** 알람 소리 시트에서만 쓰는 미리듣기(한 번에 하나) — 닫을 때·메인 닫힘 시 반드시 정지 */
  const { play: previewPlay, stop: stopPreview, playingId: previewPlayingId } = useAlarmSoundPreview()

  useEffect(() => {
    if (!open) stopPreview()
  }, [open, stopPreview])
  useEffect(() => {
    if (!soundSheet.open) stopPreview()
  }, [soundSheet.open, stopPreview])
  useEffect(() => {
    if (!addOpen) stopPreview()
  }, [addOpen, stopPreview])

  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setSheetEntered(false)
      return
    }
    setSheetEntered(false)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSheetEntered(true))
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    setHasSchool(readRoutineHasSchoolFromStorage())
    const p = readRoutineAlarmPrefs()
    setWakeTime(p.wakeTime)
    setSleepTime(p.sleepTime)
    setReturnHomeTime(p.returnHomeTime)
    setNotifyWake(p.notifyWake)
    setNotifyReturn(p.notifyReturn)
    setNotifySleep(p.notifySleep)
    setWakeOnWeekend(p.wakeOnWeekend)
    setReturnOnWeekend(p.returnOnWeekend)
    setSleepOnWeekend(p.sleepOnWeekend)
    setSoundWake(p.soundWake)
    setSoundReturn(p.soundReturn)
    setSoundSleep(p.soundSleep)
    setSoundSchool(p.soundSchool)
    setSoundSleepReady(p.soundSleepReady)
    setSchoolTime(p.schoolTime)
    setSchoolWeekday(p.schoolWeekday)
    setSchoolWeekend(p.schoolWeekend)
    setSleepReadyTime(p.sleepReadyTime)
    setSleepReadyWeekday(p.sleepReadyWeekday)
    setSleepReadyWeekend(p.sleepReadyWeekend)
    setCustomAlarms(p.customAlarms.map((c) => ({ ...c })))

    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/assets/alarm-sounds', { cache: 'no-store' })
        const { data: j, parseError } = await parseJsonFromResponse<{ sounds?: SoundItem[] }>(r)
        if (cancelled) return
        if (parseError || !j) throw new Error('alarm-sounds 비JSON 응답')
        const list = mergeRoutineAlarmPickListFromApi(Array.isArray(j.sounds) ? j.sounds : [])
        setAlarmSounds(list)
        setSoundWake((prev) => prev || CORE_DEFAULT_SOUND_BY_ROW.wake)
        setSoundReturn((prev) => prev || CORE_DEFAULT_SOUND_BY_ROW.return)
        setSoundSleep((prev) => prev || CORE_DEFAULT_SOUND_BY_ROW.sleep)
        setSoundSchool((prev) => prev || CORE_DEFAULT_SOUND_BY_ROW.school)
        setSoundSleepReady((prev) => prev || CORE_DEFAULT_SOUND_BY_ROW.sleepReady)
      } catch {
        if (cancelled) return
        const list = mergeRoutineAlarmPickListFromApi([])
        setAlarmSounds(list)
        setSoundWake((prev) => prev || CORE_DEFAULT_SOUND_BY_ROW.wake)
        setSoundReturn((prev) => prev || CORE_DEFAULT_SOUND_BY_ROW.return)
        setSoundSleep((prev) => prev || CORE_DEFAULT_SOUND_BY_ROW.sleep)
        setSoundSchool((prev) => prev || CORE_DEFAULT_SOUND_BY_ROW.school)
        setSoundSleepReady((prev) => prev || CORE_DEFAULT_SOUND_BY_ROW.sleepReady)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  /** 선택된 자녀가 있으면 서버에 저장된 등원·잘 준비 알람을 우선 표시 */
  useEffect(() => {
    if (!open || !selectedChildId) return
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('child_stats')
        .select(
          'school_time, school_time_enabled, school_time_weekday, school_time_weekend, sleep_ready_time, sleep_ready_time_enabled, sleep_ready_time_weekday, sleep_ready_time_weekend',
        )
        .eq('child_id', selectedChildId)
        .maybeSingle()
      if (cancelled || error || !data) return
      const norm = (raw: unknown) => {
        if (typeof raw !== 'string' || !/^\d{1,2}:\d{2}$/.test(raw)) return null
        const [hh, mm] = raw.split(':')
        return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`
      }
      const st = norm(data.school_time)
      if (st) setSchoolTime(st)
      if (typeof data.school_time_weekday === 'boolean') setSchoolWeekday(data.school_time_weekday)
      if (typeof data.school_time_weekend === 'boolean') setSchoolWeekend(data.school_time_weekend)
      const sr = norm(data.sleep_ready_time)
      if (sr) setSleepReadyTime(sr)
      if (typeof data.sleep_ready_time_weekday === 'boolean') setSleepReadyWeekday(data.sleep_ready_time_weekday)
      if (typeof data.sleep_ready_time_weekend === 'boolean') setSleepReadyWeekend(data.sleep_ready_time_weekend)
    })()
    return () => {
      cancelled = true
    }
  }, [open, selectedChildId])

  useEffect(() => {
    if (!addOpen || alarmSounds.length === 0) return
    setAddSound((s) => s || alarmSounds[0]?.id || '')
  }, [addOpen, alarmSounds])

  const soundLabel = useCallback(
    (id: string) => alarmSounds.find((s) => s.id === id)?.label ?? (id ? id : '소리'),
    [alarmSounds],
  )

  function openSoundPickerCore(row: 'wake' | 'return' | 'sleep' | 'school' | 'sleepReady') {
    const cur =
      row === 'wake'
        ? soundWake
        : row === 'return'
          ? soundReturn
          : row === 'sleep'
            ? soundSleep
            : row === 'school'
              ? soundSchool
              : soundSleepReady
    setPickerSound(cur || alarmSounds[0]?.id || '')
    setSoundSheet({ open: true, target: { type: 'core', row } })
  }

  function openSoundPickerCustom(index: number) {
    setPickerSound(customAlarms[index]?.soundFile || alarmSounds[0]?.id || '')
    setSoundSheet({ open: true, target: { type: 'custom', index } })
  }

  function applySound() {
    if (!soundSheet.open) return
    const v = pickerSound
    const t = soundSheet.target
    if (t.type === 'custom') {
      setCustomAlarms((prev) => prev.map((c, i) => (i === t.index ? { ...c, soundFile: v } : c)))
    } else {
      if (t.row === 'wake') setSoundWake(v)
      else if (t.row === 'return') setSoundReturn(v)
      else if (t.row === 'sleep') setSoundSleep(v)
      else if (t.row === 'school') setSoundSchool(v)
      else setSoundSleepReady(v)
    }
    setSoundSheet({ open: false })
  }

  function openAddCustom() {
    setAddLabel('')
    setAddTime('12:00')
    setAddNotify(true)
    setAddSound(alarmSounds[0]?.id ?? '')
    setAddOpen(true)
  }

  function submitAddCustom() {
    if (!addLabel.trim()) return
    const id = crypto.randomUUID()
    setCustomAlarms((prev) => [
      ...prev,
      {
        id,
        label: addLabel.trim(),
        time: addTime,
        notify: addNotify,
        soundFile: addSound || alarmSounds[0]?.id || '',
        onWeekend: true,
      },
    ])
    setAddOpen(false)
  }

  function removeCustom(id: string) {
    setCustomAlarms((prev) => prev.filter((c) => c.id !== id))
  }

  function updateCustom(index: number, patch: Partial<RoutineCustomAlarmStored>) {
    setCustomAlarms((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  async function handleSave() {
    const schoolEnabledOut = schoolWeekday || schoolWeekend
    const sleepReadyEnabledOut = sleepReadyWeekday || sleepReadyWeekend
    const next: RoutineAlarmPrefsLoaded = {
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
      sleepReadyEnabled: sleepReadyEnabledOut,
      sleepReadyWeekday,
      sleepReadyWeekend,
      schoolTime,
      soundSchool,
      schoolEnabled: schoolEnabledOut,
      schoolWeekday,
      schoolWeekend,
    }
    writeRoutineAlarmPrefs(next)
    if (selectedChildId) {
      const supabase = createClient()
      const { error } = await supabase
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
        .eq('child_id', selectedChildId)
      if (error) {
        console.warn('[routine alarm] 등원·잘 준비 알람 저장 실패:', error.message)
      }
      /**
       * 기상·잘시간·하원 포함 알람 전체를 번들로 미러링 → 다른 기기의 자녀 앱과 동기화.
       * 별도 update 로 분리해, 123 마이그레이션 미적용 DB(컬럼 없음)에서도 위 저장이 깨지지 않게 합니다.
       */
      const { error: bundleErr } = await supabase
        .from('child_stats')
        .update({ routine_alarm_prefs: serializeRoutineAlarmStorage() })
        .eq('child_id', selectedChildId)
      if (bundleErr) {
        console.warn('[routine alarm] 알람 번들 동기화 실패(123 마이그레이션 필요?):', bundleErr.message)
      }
    }
    onClose()
  }

  if (!open) return null

  const overlay = (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="routine-alarm-sheet-title">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      {/*
        메인 시트: 세로 화면은 하단 슬라이드, 패드 가로는 우측 슬라이드(알림·공지 시트와 동일).
      */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center md:landscape:inset-x-0 md:landscape:inset-y-0 md:landscape:bottom-0 md:landscape:left-auto md:landscape:right-0 md:landscape:top-0 md:landscape:justify-end">
        <div
          className={`pointer-events-auto flex max-h-[min(90dvh,100vh-1rem)] w-full max-w-none overflow-x-hidden flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out md:landscape:h-full md:landscape:max-h-none md:landscape:max-w-md md:landscape:rounded-none md:landscape:rounded-l-2xl ${
            sheetEntered
              ? 'translate-y-0 md:landscape:translate-y-0 md:landscape:translate-x-0'
              : 'translate-y-full md:landscape:translate-y-0 md:landscape:translate-x-full'
          }`}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200 md:landscape:hidden" aria-hidden />
          <div className="border-b border-gray-100 px-4 pb-2 pt-3">
            <p id="routine-alarm-sheet-title" className="text-center text-sm font-black text-gray-900">
              루틴 알람
            </p>
            <p className="mt-1 text-center text-[10px] leading-snug text-gray-500">
              자녀의 생활에 맞추어 알람을 설정해보세요.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="rounded-lg border border-gray-100 bg-white px-2 py-1.5 shadow-sm">
              {/* 제목은 flex로 한 줄에, +만 블록 오른쪽 끝(그리드 밖이라 빈 열 낭비 없음) */}
              <div className="mb-1 flex w-full min-w-0 items-center gap-2">
                <p className="min-w-0 flex-1 truncate pt-0.5 text-[10px] font-bold text-gray-600">기본 루틴 알람</p>
                <button
                  type="button"
                  onClick={openAddCustom}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-lg font-light leading-none text-[#4A90E2] transition-opacity active:opacity-60"
                  aria-label="알람 일정 추가"
                >
                  +
                </button>
              </div>
              {/* 소리·주중·주말 라벨 — 아래 컨트롤과 같은 오른쪽 묶음 안에서 열맞춤(각 w-8, 글자는 오른쪽) */}
              <div className={`${ROUTINE_ALARM_CARD_GRID} mb-0.5 items-end border-b border-gray-200 pb-1`}>
                <div aria-hidden className="min-h-px min-w-0" />
                <div className={ROUTINE_ALARM_RIGHT_CLUSTER}>
                  <span className="flex w-7 justify-end text-[8px] font-bold leading-none text-gray-500">소리</span>
                  <span className="flex w-7 justify-end text-[8px] font-bold leading-none text-gray-500">주중</span>
                  <span className="flex w-7 justify-end text-[8px] font-bold leading-none text-gray-500">주말</span>
                </div>
              </div>
              <AlarmScheduleRow
                label="기상"
                time={wakeTime}
                onTimeChange={setWakeTime}
                notify={notifyWake}
                onNotifyChange={setNotifyWake}
                weekendOn={wakeOnWeekend}
                onWeekendChange={setWakeOnWeekend}
                soundTitle={soundLabel(soundWake)}
                onPickSound={() => openSoundPickerCore('wake')}
              />
              <AlarmScheduleRow
                label="등원"
                time={schoolTime}
                onTimeChange={setSchoolTime}
                notify={schoolWeekday}
                onNotifyChange={setSchoolWeekday}
                weekendOn={schoolWeekend}
                onWeekendChange={setSchoolWeekend}
                soundTitle={soundLabel(soundSchool)}
                onPickSound={() => openSoundPickerCore('school')}
              />
              {hasSchool ? (
                <AlarmScheduleRow
                  label="하원·귀가"
                  time={returnHomeTime}
                  onTimeChange={setReturnHomeTime}
                  notify={notifyReturn}
                  onNotifyChange={setNotifyReturn}
                  weekendOn={returnOnWeekend}
                  onWeekendChange={setReturnOnWeekend}
                  soundTitle={soundLabel(soundReturn)}
                  onPickSound={() => openSoundPickerCore('return')}
                />
              ) : (
                <p className="py-2 text-[10px] text-gray-400">가정보육으로 설정된 경우 하원·귀가 알람은 쓰지 않아요.</p>
              )}
              <AlarmScheduleRow
                label="잘 준비"
                time={sleepReadyTime}
                onTimeChange={setSleepReadyTime}
                notify={sleepReadyWeekday}
                onNotifyChange={setSleepReadyWeekday}
                weekendOn={sleepReadyWeekend}
                onWeekendChange={setSleepReadyWeekend}
                soundTitle={soundLabel(soundSleepReady)}
                onPickSound={() => openSoundPickerCore('sleepReady')}
              />
              <AlarmScheduleRow
                label="잘 시간"
                time={sleepTime}
                onTimeChange={setSleepTime}
                notify={notifySleep}
                onNotifyChange={setNotifySleep}
                weekendOn={sleepOnWeekend}
                onWeekendChange={setSleepOnWeekend}
                soundTitle={soundLabel(soundSleep)}
                onPickSound={() => openSoundPickerCore('sleep')}
              />
              {customAlarms.length > 0 ? (
                <ul className="m-0 list-none space-y-0 p-0">
                  {customAlarms.map((c, idx) => (
                    <li key={c.id} className="border-b border-gray-100 last:border-b-0">
                      <CustomAlarmRow
                        item={c}
                        soundTitle={soundLabel(c.soundFile)}
                        onTimeChange={(t) => updateCustom(idx, { time: t })}
                        onNotifyChange={(n) => updateCustom(idx, { notify: n })}
                        onWeekendChange={(w) => updateCustom(idx, { onWeekend: w })}
                        onPickSound={() => openSoundPickerCustom(idx)}
                        onRemove={() => removeCustom(c.id)}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                className="flex-1 rounded-xl bg-[#4A90E2] py-2.5 text-xs font-bold text-white"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      </div>

      {soundSheet.open && (
        <div className="absolute inset-0 z-[110]" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="닫기"
            onClick={() => setSoundSheet({ open: false })}
          />
          {/*
            소리 선택 보조 시트: 메인과 같이 패드 가로에서는 오른쪽 전면 패널 형태가 자연스럽습니다.
          */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center md:landscape:inset-x-0 md:landscape:inset-y-0 md:landscape:bottom-0 md:landscape:left-auto md:landscape:right-0 md:landscape:top-0 md:landscape:justify-end">
            <div className="pointer-events-auto max-h-[70vh] w-full max-w-none overflow-y-auto rounded-t-2xl bg-white px-4 pb-6 pt-3 shadow-xl md:landscape:h-full md:landscape:max-h-none md:landscape:max-w-md md:landscape:rounded-none md:landscape:rounded-l-2xl md:landscape:shadow-2xl">
              <p className="mb-1 text-center text-sm font-black text-gray-900">알람 소리 선택</p>
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={stopPreview}
                  disabled={!previewPlayingId}
                  className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-gray-600 transition-colors enabled:hover:bg-gray-100 enabled:active:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  소리 끄기
                </button>
              </div>
              <RoutineAlarmSoundToggleList
                sounds={alarmSounds}
                selectedId={pickerSound}
                onSelect={(id) => setPickerSound(id)}
                onPreview={previewPlay}
                playingId={previewPlayingId}
                onStop={stopPreview}
                accent="parentBlue"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSoundSheet({ open: false })}
                  className="flex-1 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-600"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={applySound}
                  className="flex-1 rounded-xl bg-[#4A90E2] py-2.5 text-xs font-bold text-white"
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="absolute inset-0 z-[110]" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="닫기"
            onClick={() => setAddOpen(false)}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center md:landscape:inset-x-0 md:landscape:inset-y-0 md:landscape:bottom-0 md:landscape:left-auto md:landscape:right-0 md:landscape:top-0 md:landscape:justify-end">
            <div className="pointer-events-auto max-h-[80vh] w-full max-w-none overflow-y-auto rounded-t-2xl bg-white px-4 pb-6 pt-3 shadow-xl md:landscape:h-full md:landscape:max-h-none md:landscape:max-w-md md:landscape:rounded-none md:landscape:rounded-l-2xl md:landscape:shadow-2xl">
              <p className="mb-3 text-center text-sm font-black text-gray-900">추가 알림</p>
              <label className="mb-1 block text-[10px] font-bold text-gray-500">이름</label>
              <input
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                placeholder="예: 학원 가기"
                className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
              />
              <label className="mb-1 block text-[10px] font-bold text-gray-500">시각</label>
              <div className="mb-3">
                <InlineTimeInput value={addTime} onChange={setAddTime} ariaLabel="추가 알람 시각" className="text-sm" />
              </div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-600">알림 사용</span>
                <NotifyToggleSmall notify={addNotify} onToggle={() => setAddNotify((n) => !n)} />
              </div>
              <p className="mb-0.5 text-[10px] font-bold text-gray-500">알람 소리</p>
              <div className="mb-1.5 flex justify-end">
                <button
                  type="button"
                  onClick={stopPreview}
                  disabled={!previewPlayingId}
                  className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-gray-600 transition-colors enabled:hover:bg-gray-100 enabled:active:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  소리 끄기
                </button>
              </div>
              <RoutineAlarmSoundToggleList
                sounds={alarmSounds}
                selectedId={addSound}
                onSelect={(id) => setAddSound(id)}
                onPreview={previewPlay}
                playingId={previewPlayingId}
                onStop={stopPreview}
                accent="parentBlue"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="flex-1 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-600"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={submitAddCustom}
                  disabled={!addLabel.trim()}
                  className="flex-1 rounded-xl bg-[#4A90E2] py-2.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (!portalReady) return null
  return createPortal(overlay, document.body)
}

function CustomAlarmRow({
  item,
  soundTitle,
  onTimeChange,
  onNotifyChange,
  onWeekendChange,
  onPickSound,
  onRemove,
}: {
  item: RoutineCustomAlarmStored
  soundTitle: string
  onTimeChange: (t: string) => void
  onNotifyChange: (n: boolean) => void
  onWeekendChange: (w: boolean) => void
  onPickSound: () => void
  onRemove: () => void
}) {
  const weekend = item.onWeekend !== false
  return (
    <div className={`${ROUTINE_ALARM_CARD_GRID} py-1.5`}>
      <div className="flex min-w-0 items-center gap-1">
        <span className="w-[3.25rem] shrink-0 truncate text-[11px] font-bold text-gray-700" title={item.label}>
          {item.label}
        </span>
        <InlineTimeInput
          value={item.time}
          onChange={onTimeChange}
          ariaLabel={`${item.label} 시각`}
          className="text-xs"
        />
      </div>
      <div className={ROUTINE_ALARM_RIGHT_CLUSTER}>
        <div className="flex w-7 justify-end">
          <button
            type="button"
            onClick={onPickSound}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#4A90E2] hover:bg-[#4A90E2]/10"
            title={soundTitle}
            aria-label={`알람 소리: ${soundTitle}`}
          >
            <MusicNoteIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex w-7 justify-end">
          <NotifyToggleSmall notify={item.notify} onToggle={() => onNotifyChange(!item.notify)} />
        </div>
        <div className="flex w-7 justify-end">
          <WeekendMiniToggle on={weekend} onToggle={() => onWeekendChange(!weekend)} />
        </div>
        <div className="flex w-7 justify-end">
          <button
            type="button"
            onClick={onRemove}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-red-400 hover:bg-red-50"
            aria-label="삭제"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2m-9 4v11h10V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * 네이티브 time 입력: 시계 아이콘은 보이지 않게 숨기고(opacity 0),
 * 투명한 피커 영역을 input 전체에 깔아 탭하면 시간 선택이 되게 합니다.
 */
function InlineTimeInput({
  value,
  onChange,
  ariaLabel,
  className,
}: {
  value: string
  onChange: (v: string) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={`relative z-0 min-w-0 w-auto max-w-[9rem] shrink-0 cursor-pointer border-0 bg-transparent p-0 font-bold text-gray-900 [color-scheme:light] focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 ${className ?? 'text-xs'}`}
    />
  )
}

function MusicNoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  )
}

/** 주중(평일) 알림 on/off — 주말 토글과 같은 크기 */
function NotifyToggleSmall({ notify, onToggle }: { notify: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative h-3.5 w-7 shrink-0 rounded-full transition-all ${notify ? 'bg-[#4A90E2]' : 'bg-gray-200'}`}
      aria-pressed={notify}
      aria-label="주중 알림"
    >
      <span
        className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-all ${notify ? 'left-3.5' : 'left-0.5'}`}
      />
    </button>
  )
}

function WeekendMiniToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative h-3.5 w-7 shrink-0 rounded-full transition-all ${on ? 'bg-[#4A90E2]' : 'bg-gray-200'}`}
      aria-pressed={on}
      aria-label="주말에도 알림"
    >
      <span
        className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-all ${on ? 'left-3.5' : 'left-0.5'}`}
      />
    </button>
  )
}

function AlarmScheduleRow({
  label,
  time,
  onTimeChange,
  notify,
  onNotifyChange,
  weekendOn,
  onWeekendChange,
  soundTitle,
  onPickSound,
}: {
  label: string
  time: string
  onTimeChange: (t: string) => void
  notify: boolean
  onNotifyChange: (v: boolean) => void
  weekendOn: boolean
  onWeekendChange: (v: boolean) => void
  soundTitle: string
  onPickSound: () => void
}) {
  return (
    <div className={`${ROUTINE_ALARM_CARD_GRID} border-b border-gray-100 py-1.5`}>
      <div className="flex min-w-0 items-center gap-1">
        <span className="w-[3.25rem] shrink-0 truncate text-[11px] font-bold text-gray-700" title={label}>
          {label}
        </span>
        <InlineTimeInput value={time} onChange={onTimeChange} ariaLabel={`${label} 시각`} className="text-xs" />
      </div>
      <div className={ROUTINE_ALARM_RIGHT_CLUSTER}>
        <div className="flex w-7 justify-end">
          <button
            type="button"
            onClick={onPickSound}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#4A90E2] hover:bg-[#4A90E2]/10"
            title={soundTitle}
            aria-label={`알람 소리: ${soundTitle}`}
          >
            <MusicNoteIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex w-7 justify-end">
          <NotifyToggleSmall notify={notify} onToggle={() => onNotifyChange(!notify)} />
        </div>
        <div className="flex w-7 justify-end">
          <WeekendMiniToggle on={weekendOn} onToggle={() => onWeekendChange(!weekendOn)} />
        </div>
      </div>
    </div>
  )
}

