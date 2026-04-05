'use client'

import { useState, useEffect } from 'react'
import { useParentStore } from '@/store/parentStore'
import ChildSwitcher, { type ChildTab } from '@/components/parent/ChildSwitcher'
import type { Mission } from '@/types/database'

const DIFFICULTY_LABEL: Record<string, { text: string; color: string }> = {
  easy:    { text: '쉬움',   color: 'bg-green-100 text-green-700' },
  normal:  { text: '보통',   color: 'bg-blue-100 text-blue-700' },
  hard:    { text: '어려움', color: 'bg-orange-100 text-orange-700' },
  special: { text: '특별',   color: 'bg-purple-100 text-purple-700' },
}
const REPEAT_OPTIONS = [
  { value: 'daily',   label: '매일' },
  { value: 'weekly',  label: '주 1회' },
  { value: 'monthly', label: '월 1회' },
  { value: 'event',   label: '이벤트' },
]
const CONCEPT_TAGS = ['미션', '교환', '저축', '나눔', '투자', '도전', '학습', '기여', '건강', '습관']
const ICON_OPTIONS = ['⭐', '🪙', '📚', '🏃', '🧹', '🛁', '🥗', '💪', '🎯', '🌱', '🎨', '🎵', '🧩', '💰', '🎁']

const EMPTY_FORM = {
  title: '',
  description: '',
  icon_emoji: '⭐',
  credit_reward: 10,
  heart_reward: 0,
  exp_reward: 10,
  difficulty: 'easy' as Mission['difficulty'],
  repeat_type: 'daily' as Mission['repeat_type'],
  concept_tag: null as Mission['concept_tag'],
  level_required: 0,
  scheduled_time: '' as string, // HH:MM or ''
}

/** HH:MM → "오전/오후 H:MM" 표시용 변환 */
function formatTime(t: string | null | undefined): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr ?? '00'
  const period = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${period} ${h12}:${m}`
}

/** scheduled_time 기준 오름차순 정렬 (null → 맨 뒤) */
function sortByTime(missions: Mission[]): Mission[] {
  return [...missions].sort((a, b) => {
    if (!a.scheduled_time && !b.scheduled_time) return 0
    if (!a.scheduled_time) return 1
    if (!b.scheduled_time) return -1
    return a.scheduled_time.localeCompare(b.scheduled_time)
  })
}

type ChildInfo = { id: string; name: string; level: number }

type Props = {
  missions: Mission[]
  children: ChildInfo[]
}

export default function RoutineTab({ missions: initial, children }: Props) {
  const { selectedChildId, setSelectedChildId } = useParentStore()
  const [missions, setMissions] = useState<Mission[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // 초기 자동 선택
  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id)
    }
  }, [children, selectedChildId, setSelectedChildId])

  const currentId = selectedChildId ?? children[0]?.id
  const currentChild = children.find((c) => c.id === currentId) ?? children[0]
  const childLevel = currentChild?.level ?? 0

  const tabs: ChildTab[] = children.map((c) => ({ id: c.id, name: c.name }))

  // 선택된 자녀 레벨 기준 필터 → 시간순 정렬
  const filteredMissions = sortByTime(missions.filter((m) => m.level_required <= childLevel))
  const activeMissions = filteredMissions.filter((m) => m.is_active)
  const inactiveMissions = filteredMissions.filter((m) => !m.is_active)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

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
      if (!res.ok) { showToast(json.error ?? '오류가 발생했어요', false); return }
      setMissions((prev) => prev.map((m) => m.id === mission.id ? { ...m, is_active: !m.is_active } : m))
    } catch { showToast('네트워크 오류가 발생했어요', false) }
    finally { setLoading(null) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { showToast('미션 이름을 입력해주세요', false); return }
    setLoading('create')
    try {
      const res = await fetch('/api/mission/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          scheduled_time: form.scheduled_time || null,
        }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) { showToast(json.error ?? '오류가 발생했어요', false); return }
      if (json.mission) setMissions((prev) => [json.mission as Mission, ...prev])
      setForm(EMPTY_FORM)
      setShowForm(false)
      showToast('✅ 미션을 만들었어요!')
    } catch { showToast('네트워크 오류가 발생했어요', false) }
    finally { setLoading(null) }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 font-bold text-sm px-5 py-2.5 rounded-full shadow-lg ${toast.ok ? 'bg-[#4A90E2] text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* 자녀 전환 탭 */}
      <ChildSwitcher children={tabs} />

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-black text-gray-800 text-lg">📋 루틴 관리</p>
          {currentChild && (
            <p className="text-xs text-gray-400 mt-0.5">
              {currentChild.name} · Lv.{childLevel} 기준 미션
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-[#4A90E2] text-white text-sm font-bold px-4 py-2 rounded-xl shadow-md active:scale-95 transition-all"
        >
          {showForm ? '닫기' : '+ 미션 추가'}
        </button>
      </div>

      {/* 미션 생성 폼 */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-4">
          <p className="font-bold text-gray-800">새 미션 만들기</p>

          {/* 아이콘 */}
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1.5">아이콘</label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((ic) => (
                <button key={ic} type="button"
                  onClick={() => setForm({ ...form, icon_emoji: ic })}
                  className={`w-10 h-10 rounded-xl text-2xl flex items-center justify-center transition-all ${form.icon_emoji === ic ? 'bg-[#4A90E2]/20 ring-2 ring-[#4A90E2]' : 'bg-gray-50'}`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* 시간 */}
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">실행 시간 (선택)</label>
            <input
              type="time"
              value={form.scheduled_time}
              onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
            />
            {form.scheduled_time && (
              <span className="ml-2 text-xs text-[#4A90E2] font-bold">{formatTime(form.scheduled_time)}</span>
            )}
          </div>

          {/* 이름 */}
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">미션 이름 *</label>
            <input type="text" required maxLength={30}
              placeholder="예: 양치하기, 책 한 권 읽기"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">설명 (선택)</label>
            <input type="text" maxLength={60}
              placeholder="어떤 미션인지 짧게 설명해요"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
            />
          </div>

          {/* 보상 */}
          <div className="grid grid-cols-3 gap-3">
            <RewardInput label="🪙 크레딧" value={form.credit_reward} min={1} max={100}
              onChange={(v) => setForm({ ...form, credit_reward: v })} />
            <RewardInput label="❤️ 하트" value={form.heart_reward} min={0} max={10}
              onChange={(v) => setForm({ ...form, heart_reward: v })} />
            <RewardInput label="✨ EXP" value={form.exp_reward} min={1} max={100}
              onChange={(v) => setForm({ ...form, exp_reward: v })} />
          </div>

          {/* 난이도 */}
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1.5">난이도</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(DIFFICULTY_LABEL).map(([val, { text, color }]) => (
                <button key={val} type="button"
                  onClick={() => setForm({ ...form, difficulty: val as Mission['difficulty'] })}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${form.difficulty === val ? color + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-500'}`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          {/* 반복 주기 */}
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1.5">반복 주기</label>
            <div className="flex gap-2 flex-wrap">
              {REPEAT_OPTIONS.map((r) => (
                <button key={r.value} type="button"
                  onClick={() => setForm({ ...form, repeat_type: r.value as Mission['repeat_type'] })}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${form.repeat_type === r.value ? 'bg-[#4A90E2] text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* 최소 레벨 */}
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">최소 레벨 (0 = 모두)</label>
            <input type="number" min={0} max={5} value={form.level_required}
              onChange={(e) => setForm({ ...form, level_required: Number(e.target.value) })}
              className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
            />
          </div>

          {/* 개념 태그 */}
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1.5">개념 태그 (선택)</label>
            <div className="flex flex-wrap gap-2">
              {CONCEPT_TAGS.map((tag) => (
                <button key={tag} type="button"
                  onClick={() => setForm({ ...form, concept_tag: form.concept_tag === tag ? null : tag as Mission['concept_tag'] })}
                  className={`text-xs font-bold px-2.5 py-1 rounded-full transition-all ${form.concept_tag === tag ? 'bg-[#7ED321] text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading === 'create'}
            className="w-full py-3 bg-[#4A90E2] text-white font-bold rounded-2xl shadow-md active:scale-95 transition-all disabled:opacity-50"
          >
            {loading === 'create' ? '저장 중...' : '미션 만들기'}
          </button>
        </form>
      )}

      {/* 활성 미션 */}
      <section>
        <h2 className="text-sm font-bold text-gray-700 mb-2">
          🟢 활성 미션
          <span className="ml-1 text-gray-400 font-normal">({activeMissions.length})</span>
        </h2>
        {activeMissions.length === 0 ? (
          <div className="bg-white rounded-2xl p-5 text-center shadow-sm">
            <p className="text-sm text-gray-400">활성 미션이 없어요. 미션을 추가해보세요!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {activeMissions.map((m) => (
              <MissionCard key={m.id} mission={m} onToggle={handleToggle} loading={loading === m.id} />
            ))}
          </div>
        )}
      </section>

      {/* 비활성 미션 */}
      {inactiveMissions.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-gray-400 mb-2">
            ⚫ 비활성 미션
            <span className="ml-1 font-normal">({inactiveMissions.length})</span>
          </h2>
          <div className="flex flex-col gap-2 opacity-60">
            {inactiveMissions.map((m) => (
              <MissionCard key={m.id} mission={m} onToggle={handleToggle} loading={loading === m.id} />
            ))}
          </div>
        </section>
      )}

      {filteredMissions.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-5xl">📋</span>
          <p className="text-sm text-gray-400 text-center">
            {currentChild?.name}의 레벨에 맞는 미션이 없어요.<br />
            + 미션 추가 버튼으로 새로 만들어보세요!
          </p>
        </div>
      )}
    </div>
  )
}

// ── 서브 컴포넌트 ─────────────────────────────

function MissionCard({ mission: m, onToggle, loading }: { mission: Mission; onToggle: (m: Mission) => void; loading: boolean }) {
  const diff = DIFFICULTY_LABEL[m.difficulty]
  const timeLabel = formatTime(m.scheduled_time)
  return (
    <div className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
      <span className="text-2xl flex-shrink-0">{m.icon_emoji || '⭐'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-bold text-gray-800 truncate">{m.title}</p>
          {timeLabel && (
            <span className="text-[10px] font-bold bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
              🕐 {timeLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] text-gray-400">Lv.{m.level_required}+</span>
          {diff && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${diff.color}`}>{diff.text}</span>
          )}
          <span className="text-[10px] font-bold text-[#4A90E2]">🪙{m.credit_reward}</span>
          <span className="text-[10px] font-bold text-[#7ED321]">✨{m.exp_reward}EXP</span>
        </div>
      </div>
      {/* ON/OFF 토글 */}
      <button
        onClick={() => onToggle(m)}
        disabled={loading}
        className={`flex-shrink-0 w-12 h-6 rounded-full transition-all relative disabled:opacity-50 ${m.is_active ? 'bg-[#4A90E2]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${m.is_active ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

function RewardInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-500 block mb-1">{label}</label>
      <input type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
      />
    </div>
  )
}
