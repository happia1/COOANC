'use client'

/**
 * 부모 앱 — 루틴 관리 탭
 * - 표시: 현재 자녀에만 연결된 미션(linked_child_id 일치)만 목록에 둡니다. 시스템 풀(공용 행)은 「추가」 시트에서만 고릅니다.
 * - 주간(daily 등) / 주말·휴일(weekly) 구역은 접기 가능
 * - 미션 카드는 제목·시각·알람·활성 토글 위주로 단순화
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParentStore } from '@/store/parentStore'
import ChildProfileNav, { type ChildTab } from '@/components/parent/ChildProfileNav'
import CalendarSection from '@/components/parent/CalendarSection'
import MissionSuggestCard from '@/components/settings/MissionSuggestCard'
import type { Mission } from '@/types/database'
import {
  missionHasAlarmCue,
  parseAlarmFromMissionDescription,
} from '@/lib/missionAlarmDescription'

/** HH:MM → "오전/오후 H:MM" */
function formatTime(t: string | null | undefined): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr ?? '00'
  const period = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${period} ${h12}:${m}`
}

function sortByTime(missions: Mission[]): Mission[] {
  return [...missions].sort((a, b) => {
    if (!a.scheduled_time && !b.scheduled_time) return 0
    if (!a.scheduled_time) return 1
    if (!b.scheduled_time) return -1
    return a.scheduled_time.localeCompare(b.scheduled_time)
  })
}

/** 주말/휴일 온보딩 구간은 weekly 로 저장됨 */
function isWeekendOrHolidayMission(m: Mission): boolean {
  return m.repeat_type === 'weekly'
}

type ChildInfo = { id: string; name: string; level: number }

type Props = {
  missions: Mission[]
  children: ChildInfo[]
}

/** 루틴 탭 목록: 이 자녀 전용 행만 (시스템 공용 행은 추가 시트에서만 선택) */
function missionsLinkedToChild(list: Mission[], childId: string | null): Mission[] {
  if (!childId) return []
  return list.filter((m) => m.linked_child_id === childId)
}

export default function RoutineTab({ missions: initial, children }: Props) {
  const { selectedChildId, setSelectedChildId } = useParentStore()
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [alarmMission, setAlarmMission] = useState<Mission | null>(null)

  const [openWeekdayActive, setOpenWeekdayActive] = useState(true)
  const [openWeekendActive, setOpenWeekendActive] = useState(true)
  const [openWeekdayInactive, setOpenWeekdayInactive] = useState(true)
  const [openWeekendInactive, setOpenWeekendInactive] = useState(true)

  useEffect(() => {
    if (children.length === 0) {
      setSelectedChildId(null)
      return
    }
    const stillThere = selectedChildId && children.some((c) => c.id === selectedChildId)
    if (!stillThere) {
      setSelectedChildId(children[0].id)
    }
  }, [children, selectedChildId, setSelectedChildId])

  const currentId = selectedChildId ?? children[0]?.id ?? null
  const currentChild = children.find((c) => c.id === currentId) ?? children[0]
  const childLevel = currentChild?.level ?? 0
  const tabs: ChildTab[] = children.map((c) => ({ id: c.id, name: c.name }))

  const scopedInitial = useMemo(() => missionsLinkedToChild(initial, currentId), [initial, currentId])
  const [missions, setMissions] = useState<Mission[]>(scopedInitial)
  useEffect(() => {
    setMissions(scopedInitial)
  }, [scopedInitial])

  /** 시스템 풀: linked_child_id 없음 */
  const systemTemplates = useMemo(
    () => initial.filter((m) => m.linked_child_id == null && m.level_required <= childLevel),
    [initial, childLevel],
  )

  const childTitles = useMemo(() => new Set(missions.map((m) => m.title.trim())), [missions])

  const addableTemplates = useMemo(
    () => systemTemplates.filter((t) => !childTitles.has(t.title.trim())),
    [systemTemplates, childTitles],
  )

  const filteredMissions = sortByTime(missions.filter((m) => m.level_required <= childLevel))
  const activeMissions = filteredMissions.filter((m) => m.is_active)
  const inactiveMissions = filteredMissions.filter((m) => !m.is_active)

  const weekdayActive = activeMissions.filter((m) => !isWeekendOrHolidayMission(m))
  const weekendActive = activeMissions.filter((m) => isWeekendOrHolidayMission(m))
  const weekdayInactive = inactiveMissions.filter((m) => !isWeekendOrHolidayMission(m))
  const weekendInactive = inactiveMissions.filter((m) => isWeekendOrHolidayMission(m))

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }, [])

  async function handleToggle(mission: Mission) {
    setLoading(mission.id)
    try {
      const res = await fetch('/api/mission/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId: mission.id, isActive: !mission.is_active }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) {
        showToast(json.error ?? '오류가 발생했어요', false)
        return
      }
      setMissions((prev) => prev.map((m) => (m.id === mission.id ? { ...m, is_active: !m.is_active } : m)))
    } catch {
      showToast('네트워크 오류가 발생했어요', false)
    } finally {
      setLoading(null)
    }
  }

  async function handleCloneTemplate(templateId: string) {
    if (!currentId) return
    setLoading('clone')
    try {
      const res = await fetch('/api/mission/clone-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, childId: currentId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(typeof json.error === 'string' ? json.error : '추가에 실패했어요', false)
        return
      }
      if (json.mission) {
        setMissions((prev) => [json.mission as Mission, ...prev])
        showToast('미션을 추가했어요')
        setAddSheetOpen(false)
      }
    } catch {
      showToast('네트워크 오류가 발생했어요', false)
    } finally {
      setLoading(null)
    }
  }

  function mergeMission(updated: Mission) {
    setMissions((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
  }

  return (
    <div className="flex flex-col gap-3">
      {toast && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-[60] font-bold text-sm px-5 py-2.5 rounded-full shadow-lg ${
            toast.ok ? 'bg-[#4A90E2] text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-black text-gray-800">📋 루틴 관리</h1>
      </div>

      {/* 자녀 프로필 블록 — 이름·레벨 정렬, 다자녀는 슬라이드만 카드 하단에 */}
      {currentChild && (
        <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#4A90E2]/12 text-base font-black text-[#4A90E2]"
              aria-hidden
            >
              {currentChild.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-gray-900">{currentChild.name}</p>
              <p className="text-[11px] text-gray-500">Lv.{childLevel} · 이 자녀 루틴만 표시</p>
            </div>
          </div>
          <ChildProfileNav tabs={tabs} compact />
        </div>
      )}

      {/* 활성 미션 — 헤더와 + 동일 행 */}
      <section>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-800">
            🟢 활성 미션
            <span className="ml-1 font-normal text-gray-400">({activeMissions.length})</span>
          </h2>
          <button
            type="button"
            aria-label="미션 추가"
            disabled={!currentId || loading === 'clone'}
            onClick={() => setAddSheetOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4A90E2] text-xl font-light leading-none text-white shadow-md transition-all active:scale-95 disabled:opacity-40"
          >
            +
          </button>
        </div>

        {activeMissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center">
            <p className="text-xs text-gray-500">
              아직 이 자녀 전용 미션이 없어요.
              <br />
              오른쪽 + 로 시스템 미션을 골라 추가해 주세요.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <CollapsibleBlock
              title="주간 미션"
              count={weekdayActive.length}
              open={openWeekdayActive}
              onToggle={() => setOpenWeekdayActive((v) => !v)}
            >
              {weekdayActive.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-gray-400">주간 미션이 없어요</p>
              ) : (
                weekdayActive.map((m) => (
                  <MissionRow
                    key={m.id}
                    mission={m}
                    loading={loading === m.id}
                    onToggle={handleToggle}
                    onAlarmClick={() => setAlarmMission(m)}
                  />
                ))
              )}
            </CollapsibleBlock>

            <CollapsibleBlock
              title="주말 · 휴일 미션"
              count={weekendActive.length}
              open={openWeekendActive}
              onToggle={() => setOpenWeekendActive((v) => !v)}
            >
              {weekendActive.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-gray-400">주말·휴일 미션이 없어요</p>
              ) : (
                weekendActive.map((m) => (
                  <MissionRow
                    key={m.id}
                    mission={m}
                    loading={loading === m.id}
                    onToggle={handleToggle}
                    onAlarmClick={() => setAlarmMission(m)}
                  />
                ))
              )}
            </CollapsibleBlock>
          </div>
        )}
      </section>

      {inactiveMissions.length > 0 && (
        <section>
          <h2 className="mb-1.5 text-sm font-bold text-gray-400">
            ⚫ 비활성 미션
            <span className="ml-1 font-normal">({inactiveMissions.length})</span>
          </h2>
          <div className="flex flex-col gap-2 opacity-90">
            <CollapsibleBlock
              title="주간"
              count={weekdayInactive.length}
              open={openWeekdayInactive}
              onToggle={() => setOpenWeekdayInactive((v) => !v)}
            >
              {weekdayInactive.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-gray-400">없음</p>
              ) : (
                weekdayInactive.map((m) => (
                  <MissionRow
                    key={m.id}
                    mission={m}
                    loading={loading === m.id}
                    onToggle={handleToggle}
                    onAlarmClick={() => setAlarmMission(m)}
                  />
                ))
              )}
            </CollapsibleBlock>
            <CollapsibleBlock
              title="주말 · 휴일"
              count={weekendInactive.length}
              open={openWeekendInactive}
              onToggle={() => setOpenWeekendInactive((v) => !v)}
            >
              {weekendInactive.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-gray-400">없음</p>
              ) : (
                weekendInactive.map((m) => (
                  <MissionRow
                    key={m.id}
                    mission={m}
                    loading={loading === m.id}
                    onToggle={handleToggle}
                    onAlarmClick={() => setAlarmMission(m)}
                  />
                ))
              )}
            </CollapsibleBlock>
          </div>
        </section>
      )}

      <CalendarSection childId={currentId ?? null} />
      <MissionSuggestCard />

      <AddMissionBottomSheet
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        templates={addableTemplates}
        loading={loading === 'clone'}
        onPick={handleCloneTemplate}
      />

      <AlarmEditBottomSheet
        mission={alarmMission}
        onClose={() => setAlarmMission(null)}
        onSaved={(m) => {
          mergeMission(m)
          setAlarmMission(null)
          showToast('알림을 저장했어요')
        }}
        showToast={showToast}
      />
    </div>
  )
}

/** 접었다 펼치는 구역 */
function CollapsibleBlock({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50"
      >
        <span className="text-xs font-bold text-gray-700">
          {title}
          <span className="ml-1 font-normal text-gray-400">({count})</span>
        </span>
        <span className="text-gray-400 text-xs tabular-nums" aria-hidden>
          {open ? '▼' : '▶'}
        </span>
      </button>
      {open && <div className="flex flex-col gap-1.5 border-t border-gray-100 px-2 py-2">{children}</div>}
    </div>
  )
}

function MissionRow({
  mission: m,
  onToggle,
  onAlarmClick,
  loading,
}: {
  mission: Mission
  onToggle: (m: Mission) => void
  onAlarmClick: () => void
  loading: boolean
}) {
  const timeLabel = formatTime(m.scheduled_time)
  const alarmOn = missionHasAlarmCue(m)

  return (
    <div className="flex items-center gap-2 rounded-lg bg-white px-2 py-2 shadow-sm ring-1 ring-gray-100">
      <span className="text-2xl shrink-0" aria-hidden>
        {m.icon_emoji || '⭐'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-gray-800">{m.title}</p>
        {timeLabel ? <p className="text-[11px] text-gray-500">{timeLabel}</p> : null}
      </div>
      <button
        type="button"
        onClick={onAlarmClick}
        aria-label={alarmOn ? '알림 켜짐, 눌러 수정' : '알림 끄기·설정'}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-base transition-colors ${
          alarmOn
            ? 'border-amber-200 bg-amber-50 text-amber-600'
            : 'border-gray-200 bg-gray-50 text-gray-400'
        }`}
      >
        🔔
      </button>
      <button
        type="button"
        onClick={() => onToggle(m)}
        disabled={loading}
        aria-pressed={m.is_active}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-all disabled:opacity-50 ${
          m.is_active ? 'bg-[#4A90E2]' : 'bg-gray-200'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
            m.is_active ? 'left-5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}

type SoundItem = { id: string; label: string; url: string }

function AddMissionBottomSheet({
  open,
  onClose,
  templates,
  loading,
  onPick,
}: {
  open: boolean
  onClose: () => void
  templates: Mission[]
  loading: boolean
  onPick: (templateId: string) => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" role="dialog" aria-modal="true" aria-labelledby="add-mission-title">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      <div className="relative max-h-[78vh] flex flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200" aria-hidden />
        <div className="border-b border-gray-100 px-4 pb-2 pt-3">
          <p id="add-mission-title" className="text-center text-sm font-black text-gray-900">
            시스템 미션에서 추가
          </p>
          <p className="mt-1 text-center text-[10px] leading-snug text-gray-500">
            아직 이 자녀 루틴에 없는 항목만 보여요. 같은 이름은 중복 추가할 수 없어요.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-2">
          {templates.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">추가할 수 있는 미션이 없어요</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onPick(t.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5 text-left transition-all active:scale-[0.99] hover:border-[#4A90E2]/40 disabled:opacity-50"
                  >
                    <span className="text-xl">{t.icon_emoji || '⭐'}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-800">{t.title}</span>
                    <span className="text-xs text-[#4A90E2]">추가</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function AlarmEditBottomSheet({
  mission,
  onClose,
  onSaved,
  showToast,
}: {
  mission: Mission | null
  onClose: () => void
  onSaved: (m: Mission) => void
  showToast: (msg: string, ok?: boolean) => void
}) {
  const [notify, setNotify] = useState(false)
  const [time, setTime] = useState('07:00')
  const [soundId, setSoundId] = useState('')
  const [sounds, setSounds] = useState<SoundItem[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!mission) return
    const hasTime = Boolean(mission.scheduled_time && /^\d{2}:\d{2}$/.test(mission.scheduled_time))
    setNotify(hasTime || missionHasAlarmCue(mission))
    setTime(hasTime ? (mission.scheduled_time as string) : '07:00')
    const f = parseAlarmFromMissionDescription(mission.description).alarmFile
    setSoundId(f ?? '')

    let cancelled = false
    fetch('/api/assets/alarm-sounds')
      .then((r) => r.json())
      .then((j: { sounds?: SoundItem[] }) => {
        if (cancelled) return
        const list = Array.isArray(j.sounds) ? j.sounds : []
        setSounds(list)
        const fromMission = parseAlarmFromMissionDescription(mission.description).alarmFile
        setSoundId(fromMission || list[0]?.id || '')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [mission])

  async function save() {
    if (!mission) return
    setSaving(true)
    try {
      const res = await fetch('/api/mission/patch-schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionId: mission.id,
          scheduled_time: notify ? time : null,
          alarmFile: notify ? (soundId || null) : null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.mission) {
        showToast(typeof json.error === 'string' ? json.error : '저장에 실패했어요', false)
        return
      }
      onSaved(json.mission as Mission)
    } catch {
      showToast('네트워크 오류가 발생했어요', false)
    } finally {
      setSaving(false)
    }
  }

  if (!mission) return null

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end" role="dialog" aria-modal="true" aria-labelledby="alarm-sheet-title">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      <div className="relative max-h-[85vh] flex flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-200" aria-hidden />
        <div className="border-b border-gray-100 px-4 py-3">
          <p id="alarm-sheet-title" className="text-center text-sm font-black text-gray-900">
            알림 설정
          </p>
          <p className="mt-0.5 truncate text-center text-xs text-gray-500">{mission.title}</p>
        </div>
        <div className="space-y-4 overflow-y-auto px-4 pb-4 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700">알림 사용</span>
            <button
              type="button"
              onClick={() => setNotify((n) => !n)}
              className={`relative h-7 w-12 rounded-full transition-all ${notify ? 'bg-[#4A90E2]' : 'bg-gray-200'}`}
              aria-pressed={notify}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                  notify ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
          {notify && (
            <>
              <div>
                <label className="mb-1 block text-[10px] font-bold text-gray-500">알림 시각</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-800"
                />
              </div>
              <div>
                <p className="mb-1 text-[10px] font-bold text-gray-500">알람 소리</p>
                <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                  {sounds.length === 0 ? (
                    <p className="text-[10px] text-gray-400">목록을 불러오는 중…</p>
                  ) : (
                    sounds.map((s) => {
                      const on = soundId === s.id
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSoundId(s.id)}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                            on ? 'border-[#4A90E2] bg-[#4A90E2] text-white' : 'border-gray-200 text-gray-600'
                          }`}
                        >
                          {s.label}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-600"
          >
            취소
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="flex-1 rounded-xl bg-[#4A90E2] py-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
