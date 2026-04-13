'use client'

/**
 * 루틴 도우미 일정 확인 카드 전용 슬롯 피커입니다.
 * - 날짜: 연·월·일 세 줄에서 골라 `YYYY-MM-DD` 로 돌려줍니다.
 * - 유형: 한 줄짜리 목록에서 고릅니다.
 * - 모바일에서 손가락으로 위아래 스크롤해 고를 수 있게 `overflow-y-auto` 를 씁니다.
 */

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** 해당 연·월의 일 수 */
function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** `YYYY-MM-DD` 가 유효한지 검사한 뒤 없으면 그 달 말일로 맞춥니다 */
function clampYmd(y: number, m: number, d: number): string {
  const max = daysInMonth(y, m)
  const dd = Math.min(Math.max(1, d), max)
  return `${y}-${pad2(m)}-${pad2(dd)}`
}

type ThreeColProps = {
  /** 현재 값 `YYYY-MM-DD` */
  value: string
  /** 부모가 날짜 문자열을 갱신합니다 */
  onChange: (iso: string) => void
  /** 적용 후 피커를 접습니다 */
  onDone: () => void
}

/**
 * 연·월·일 세 컬럼 슬롯 피커.
 * - 가운데 줄이 진하게 보이도록 같은 리스트라도 선택값 주변을 크게 씁니다.
 */
export function RoutineAgentDateSlotPicker({ value, onChange, onDone }: ThreeColProps) {
  const vy = Number(value.slice(0, 4)) || new Date().getFullYear()
  const vm = Number(value.slice(5, 7)) || 1
  const vd = Number(value.slice(8, 10)) || 1

  const [y, setY] = useState(vy)
  const [m, setM] = useState(vm)
  const [d, setD] = useState(vd)

  useEffect(() => {
    setY(vy)
    setM(vm)
    setD(vd)
  }, [value, vy, vm, vd])

  const years = useMemo(() => {
    const out: number[] = []
    for (let i = vy - 2; i <= vy + 5; i++) out.push(i)
    return out
  }, [vy])

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])
  const days = useMemo(() => Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1), [y, m])

  const apply = (ny: number, nm: number, nd: number) => {
    const iso = clampYmd(ny, nm, nd)
    onChange(iso)
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-md ring-1 ring-violet-100/40"
    >
      <div className="relative grid grid-cols-3 gap-0 divide-x divide-gray-100">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-white via-white/90 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-white via-white/90 to-transparent" />
        <div className="routine-agent-hide-scrollbar max-h-44 overflow-y-auto py-8">
          {years.map((yy) => (
            <button
              key={yy}
              type="button"
              onClick={() => {
                setY(yy)
                apply(yy, m, d)
              }}
              className={`block w-full py-1.5 text-center text-[12px] ${
                yy === y ? 'font-black text-violet-800' : 'font-medium text-gray-500'
              }`}
            >
              {yy}
            </button>
          ))}
        </div>
        <div className="routine-agent-hide-scrollbar max-h-44 overflow-y-auto py-8">
          {months.map((mm) => (
            <button
              key={mm}
              type="button"
              onClick={() => {
                setM(mm)
                const maxD = daysInMonth(y, mm)
                const nd = Math.min(d, maxD)
                setD(nd)
                apply(y, mm, nd)
              }}
              className={`block w-full py-1.5 text-center text-[12px] ${
                mm === m ? 'font-black text-violet-800' : 'font-medium text-gray-500'
              }`}
            >
              {pad2(mm)}
            </button>
          ))}
        </div>
        <div className="routine-agent-hide-scrollbar max-h-44 overflow-y-auto py-8">
          {days.map((dd) => (
            <button
              key={dd}
              type="button"
              onClick={() => {
                setD(dd)
                apply(y, m, dd)
              }}
              className={`block w-full py-1.5 text-center text-[12px] ${
                dd === d ? 'font-black text-violet-800' : 'font-medium text-gray-500'
              }`}
            >
              {pad2(dd)}
            </button>
          ))}
        </div>
      </div>
      <div className="border-t border-gray-100 px-2 py-2">
        <button
          type="button"
          onClick={() => {
            onChange(clampYmd(y, m, d))
            onDone()
          }}
          className="w-full rounded-lg bg-violet-500 py-2 text-[11px] font-black text-white shadow-sm active:scale-[0.99]"
        >
          적용하고 닫기
        </button>
      </div>
    </motion.div>
  )
}

type OneColProps = {
  options: { value: string; label: string }[]
  value: string
  onPick: (value: string) => void
}

/** 유형 한 컬럼 — 한 번 누르면 곧바로 반영됩니다 */
export function RoutineAgentTypeSlotPicker({ options, value, onPick }: OneColProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-md ring-1 ring-violet-100/40"
    >
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-white to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-white to-transparent" />
        <div className="routine-agent-hide-scrollbar max-h-40 overflow-y-auto py-6">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onPick(o.value)}
              className={`block w-full py-2 text-center text-[12px] ${
                o.value === value ? 'font-black text-violet-800' : 'font-medium text-gray-600'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/** 날짜 피커를 감싸 등장·퇴장 애니메이션만 담당합니다 */
export function RoutineAgentPickerPresence(props: { show: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {props.show ? <div className="mt-1.5">{props.children}</div> : null}
    </AnimatePresence>
  )
}
