'use client'

/**
 * 부모 「루틴 알람 설정」전용 시트 — 알람시계(alarm.png) 느낌의 생활 알람만 다룹니다.
 * - 알림·공지는 상단 `notice.png` 버튼의 ParentBellBoardSheet 를 씁니다(루틴 설정은 알람시계 버튼만).
 * - 온보딩과 동일한 기상·하원·귀가·취침 + 추가 일정, 우측 + 로 추가, 행마다 삭제 가능
 */

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  readRoutineAlarmPrefs,
  readRoutineHasSchoolFromStorage,
  writeRoutineAlarmPrefs,
  type RoutineAlarmPrefsLoaded,
  type RoutineCustomAlarmStored,
} from '@/lib/routineAlarmLocalPrefs'

type SoundItem = { id: string; label: string; url: string }

type SoundPickTarget =
  | { type: 'core'; row: 'wake' | 'return' | 'sleep' }
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
    setCustomAlarms(p.customAlarms.map((c) => ({ ...c })))

    let cancelled = false
    fetch('/api/assets/alarm-sounds')
      .then((r) => r.json())
      .then((j: { sounds?: SoundItem[] }) => {
        if (cancelled) return
        const list = Array.isArray(j.sounds) ? j.sounds : []
        setAlarmSounds(list)
        const first = list[0]?.id ?? ''
        setSoundWake((prev) => prev || first)
        setSoundReturn((prev) => prev || first)
        setSoundSleep((prev) => prev || first)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!addOpen || alarmSounds.length === 0) return
    setAddSound((s) => s || alarmSounds[0]?.id || '')
  }, [addOpen, alarmSounds])

  const soundLabel = useCallback(
    (id: string) => alarmSounds.find((s) => s.id === id)?.label ?? (id ? id : '소리'),
    [alarmSounds],
  )

  const playPreview = useCallback((url: string) => {
    try {
      void new Audio(url).play()
    } catch {
      /* 무시 */
    }
  }, [])

  function openSoundPickerCore(row: 'wake' | 'return' | 'sleep') {
    const cur = row === 'wake' ? soundWake : row === 'return' ? soundReturn : soundSleep
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
      else setSoundSleep(v)
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

  function handleSave() {
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
    }
    writeRoutineAlarmPrefs(next)
    onClose()
  }

  if (!open) return null

  const overlay = (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="routine-alarm-sheet-title">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <div
          className={`pointer-events-auto flex max-h-[min(90dvh,100vh-1rem)] w-full max-w-md overflow-x-hidden flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out ${
            sheetEntered ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200" aria-hidden />
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
                label="취침"
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
                onClick={handleSave}
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
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
            <div className="pointer-events-auto max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white px-4 pb-6 pt-3 shadow-xl">
              <p className="mb-2 text-center text-sm font-black text-gray-900">알람 소리 선택</p>
              <SoundToggleList
                sounds={alarmSounds}
                selectedId={pickerSound}
                onSelect={(id) => {
                  setPickerSound(id)
                  const u = alarmSounds.find((s) => s.id === id)?.url
                  if (u) playPreview(u)
                }}
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
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
            <div className="pointer-events-auto max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white px-4 pb-6 pt-3 shadow-xl">
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
              <p className="mb-1 text-[10px] font-bold text-gray-500">알람 소리</p>
              <SoundToggleList
                sounds={alarmSounds}
                selectedId={addSound}
                onSelect={(id) => {
                  setAddSound(id)
                  const u = alarmSounds.find((s) => s.id === id)?.url
                  if (u) playPreview(u)
                }}
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

function SoundToggleList({
  sounds,
  selectedId,
  onSelect,
}: {
  sounds: SoundItem[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  if (!sounds.length) {
    return (
      <p className="rounded-lg bg-gray-50 px-2 py-2 text-[10px] leading-snug text-gray-500">
        알람 음원 목록을 불러오는 중이거나 폴더가 비어 있어요.
      </p>
    )
  }
  return (
    <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto py-1">
      {sounds.map((s) => {
        const on = selectedId === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={[
              'rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all',
              on ? 'border-[#4A90E2] bg-[#4A90E2] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#4A90E2]/40',
            ].join(' ')}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
