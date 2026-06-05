'use client'

/**
 * 숫자를 슬롯머신처럼 한 자리씩 굴려 올리거나 내리는 표시기입니다.
 *
 * 비개발자 설명:
 * - 미션 카드를 누르면 하트·크레딧 숫자가 툭 튀지 않고, 자릿수가 천천히 돌아가며 올라갑니다.
 * - 코인·하트 파티클이 날아가는 동안 숫자도 같이 올라가 보이도록 시작 시점을 조절할 수 있어요.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

export type SlotCounterTiming = {
  /** 자릿수가 바뀔 때마다 기다리는 시간(ms) */
  tickMs: number
  /** 첫 자릿수가 움직이기 전 대기(ms) — 파티클 도착과 맞출 때 사용 */
  initialDelayMs: number
}

/** 한 자리 숫자 — 0~9 세로 스트립을 translateY 로 굴립니다 */
function DigitSlot({ digit, color }: { digit: number; color: string }) {
  const d = ((digit % 10) + 10) % 10
  const digitHeightEm = 1.2
  return (
    <span
      className="relative inline-block overflow-hidden align-baseline tabular-nums"
      style={{ width: '0.72em', height: `${digitHeightEm}em` }}
      aria-hidden
    >
      <span
        className="absolute left-0 top-0 flex flex-col transition-transform duration-[180ms] ease-out motion-reduce:transition-none motion-reduce:transform-none"
        style={{ transform: `translateY(-${d * digitHeightEm}em)` }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span
            key={n}
            className="flex shrink-0 items-center justify-center font-black leading-none"
            style={{ height: `${digitHeightEm}em`, fontSize: 'inherit', color }}
          >
            {n}
          </span>
        ))}
      </span>
    </span>
  )
}

function SlotDigits({ value, minDigits, color }: { value: number; minDigits: number; color: string }) {
  const v = Math.max(0, Math.floor(value))
  const raw = v.toString().split('')
  const pad = Math.max(0, minDigits - raw.length)
  const digits = [...Array(pad).fill('0'), ...raw]
  return (
    <span className="inline-flex items-baseline gap-[0.06em]" style={{ fontSize: 'inherit' }}>
      {digits.map((ch, i) => (
        <DigitSlot key={`${i}-${digits.length}`} digit={Number(ch)} color={color} />
      ))}
    </span>
  )
}

function buildSlotSteps(from: number, to: number): number[] {
  const a = Math.max(0, Math.floor(from))
  const b = Math.max(0, Math.floor(to))
  if (a === b) return [a]
  const diff = Math.abs(a - b)
  const maxFrames = 24
  const frameCount = Math.min(maxFrames, Math.max(8, Math.ceil(diff / 12)))
  const out: number[] = []
  for (let i = 0; i <= frameCount; i++) {
    const t = i / frameCount
    const eased = 1 - (1 - t) ** 3
    const n = Math.round(a + (b - a) * eased)
    if (out.length === 0 || out[out.length - 1] !== n) out.push(n)
  }
  if (out[out.length - 1] !== b) out.push(b)
  return out
}

function useSlotCounterAnimation(
  from: number,
  to: number,
  runId: number,
  timing: SlotCounterTiming,
) {
  const [stepIndex, setStepIndex] = useState(0)
  const active = runId > 0

  const steps = useMemo(() => buildSlotSteps(from, to), [from, to])

  useEffect(() => {
    if (!active) {
      setStepIndex(0)
      return
    }
    setStepIndex(0)
    if (steps.length <= 1) return

    let cancelled = false
    let i = 0
    const tick = () => {
      if (cancelled) return
      i += 1
      setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))
      if (i < steps.length - 1) {
        window.setTimeout(tick, timing.tickMs)
      }
    }
    const id = window.setTimeout(tick, timing.initialDelayMs)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [active, steps, runId, timing.tickMs, timing.initialDelayMs])

  const current = active ? (steps[Math.min(stepIndex, steps.length - 1)] ?? from) : to
  const done = !active || stepIndex >= steps.length - 1
  return { current, done, steps }
}

type SlotCounterProps = {
  value: number
  timing?: SlotCounterTiming
  color?: string
  className?: string
  style?: React.CSSProperties
}

/** 자녀 홈 레벨 카드 — 코인 파티클이 날아가는 동안 크레딧 숫자가 오르기 시작 */
export const CHILD_HOME_CREDIT_SLOT_TIMING: SlotCounterTiming = {
  tickMs: 130,
  initialDelayMs: 280,
}

/** 자녀 홈 레벨 카드 — 하트 파티클은 코인보다 늦게 출발하므로 시작도 조금 늦춤 */
export const CHILD_HOME_HEART_SLOT_TIMING: SlotCounterTiming = {
  tickMs: 140,
  initialDelayMs: 820,
}

export default function SlotCounter({
  value,
  timing = { tickMs: 150, initialDelayMs: 0 },
  color = '#7A4F00',
  className = '',
  style,
}: SlotCounterProps) {
  const target = Math.max(0, Math.floor(value))
  const mountedRef = useRef(false)
  const settledRef = useRef(target)
  const reduceMotionRef = useRef(false)
  const [fromValue, setFromValue] = useState(target)
  const [runId, setRunId] = useState(0)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      reduceMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
  }, [])

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      settledRef.current = target
      return
    }
    if (target === settledRef.current) return
    if (reduceMotionRef.current) {
      settledRef.current = target
      return
    }
    setFromValue(settledRef.current)
    setRunId((r) => r + 1)
  }, [target])

  const { current, done } = useSlotCounterAnimation(fromValue, target, runId, timing)

  useEffect(() => {
    if (done) {
      settledRef.current = target
    }
  }, [done, target])

  const displayValue = runId > 0 && !done ? current : target
  const minDigits = Math.max(
    fromValue.toString().length,
    target.toString().length,
    1,
  )

  return (
    <span
      className={`inline-flex min-w-0 items-baseline font-black tabular-nums leading-none ${className}`}
      style={style}
      aria-live="polite"
      aria-atomic="true"
    >
      <SlotDigits value={displayValue} minDigits={minDigits} color={color} />
    </span>
  )
}
