'use client'

/**
 * COOANC 로딩 화면용 토끼 달리기 애니메이션입니다.
 *
 * - `public/assets/img/characters/onboarding/bunny_run.png` 한 장(스프라이트 시트)과
 * - TexturePacker가 보낸 `bunny_run.json` 을 읽어,
 *   프레임마다 잘린 영역을 캔버스에 그립니다.
 * - 일부 프레임은 시트 안에서 90° 돌아가 저장되어 있어(`rotated: true`),
 *   그릴 때 반대로 회전해 원래 모습으로 되돌립니다.
 * - 프레임이 바뀔 때 잠깐 이전 그림과 다음 그림을 겹쳐 그려(크로스페이드) 달리기가 덜 끊기게 보이게 합니다.
 */

import { useEffect, useRef, useState } from 'react'

/** public 폴더 기준 URL — 브라우저에서 그대로 요청합니다. */
const ATLAS_JSON_URL = '/assets/img/characters/onboarding/bunny_run.json'
const SHEET_IMAGE_URL = '/assets/img/characters/onboarding/bunny_run.png'

/**
 * 한 “발자국” 주기(ms) = 이 프레임을 주로 보여 주는 시간 + 다음 프레임으로 스며드는 시간.
 * 숫자를 줄이면 더 빨리 달립니다.
 */
const FRAME_HOLD_MS = 68
/** 이전 자세와 다음 자세가 겹쳐 보이는 시간 — 짧은 영화 필름처럼 이어집니다. */
const CROSSFADE_MS = 52
const FRAME_CELL_MS = FRAME_HOLD_MS + CROSSFADE_MS

/** 화면에 보이는 캔버스 박스(px) — 예전 200×380 의 절반 크기입니다. */
const DISPLAY_CSS_W = 100
const DISPLAY_CSS_H = 190

/** 0~1 값을 부드럽게 꺾어 주는 smoothstep — 깜빡임 대신 천천히 섞입니다. */
function smoothstep01(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/** TexturePacker `frame` 객체 — 시트 안의 픽셀 사각형입니다. */
type TpRect = { x: number; y: number; w: number; h: number }

/** JSON 안의 각 프레임 한 줄에 해당합니다. */
type TpFrameEntry = {
  frame: TpRect
  rotated: boolean
  sourceSize: { w: number; h: number }
}

/** 전체 아틀라스 JSON 루트 형태입니다. */
type BunnyRunAtlas = {
  frames: Record<string, TpFrameEntry>
  meta: { size: { w: number; h: number } }
}

/**
 * 프레임 이름(`bunny_run (3).png` …)에 들어 있는 번호로 정렬해
 * 달리기 순서(1 → 6)를 맞춥니다.
 */
function orderedFrameKeys(frames: Record<string, TpFrameEntry>): string[] {
  return Object.keys(frames).sort((a, b) => {
    const na = Number(/\((\d+)\)/.exec(a)?.[1] ?? 0)
    const nb = Number(/\((\d+)\)/.exec(b)?.[1] ?? 0)
    return na - nb
  })
}

/**
 * 모든 프레임을 돌며, 화면에 맞출 때 필요한 최대 가로·세로(논리 픽셀)를 구합니다.
 * 캔버스 크기를 고정해 두면 프레임이 바뀔 때 레이아웃이 흔들리지 않습니다.
 */
function maxSourceSize(frames: Record<string, TpFrameEntry>, keys: string[]) {
  let mw = 0
  let mh = 0
  for (const k of keys) {
    const s = frames[k].sourceSize
    mw = Math.max(mw, s.w)
    mh = Math.max(mh, s.h)
  }
  return { mw, mh }
}

type Props = {
  /** 로딩 문구 — 기본은 「열심히 달려가는 중!」입니다. */
  message?: string
  /** 바깥 컨테이너에 Tailwind 등을 더할 때 사용합니다. */
  className?: string
}

/**
 * 아틀라스의 한 프레임을 논리 좌표(0,0)~(canvasW, canvasH) 안 가운데에 그립니다.
 *
 * TexturePacker JSON에서 `rotated: true`인 프레임은
 * - `sourceSize`(게임에 쓸 최종 가로·세로, 예: 토끼가 서 있는 156×340)와
 * - 시트 PNG 안에 실제로 깔린 직사각형의 가로·세로가 서로 바뀝니다.
 *   즉 JSON의 `frame.w` / `frame.h`는 “원본 스프라이트 크기”에 가깝고,
 *   시트에서 잘라야 할 픽셀 영역은 `frame.h` × `frame.w` 입니다.
 *   (이걸 안 바꾸면 시트 밖까지 잘라려 해서 옆 프레임이 섞이거나 잘려 보입니다.)
 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  entry: TpFrameEntry,
  canvasW: number,
  canvasH: number,
) {
  const { x: sx, y: sy, w: fw, h: fh } = entry.frame
  /** 시트에서 잘라올 가로·세로 — 회전 프레임만 w/h 를 뒤집습니다. */
  const swSheet = entry.rotated ? fh : fw
  const shSheet = entry.rotated ? fw : fh
  const { w: dw, h: dh } = entry.sourceSize
  const cx = canvasW / 2
  const cy = canvasH / 2

  if (!entry.rotated) {
    // 회전 없음: JSON frame 좌표 그대로 잘라 sourceSize 크기로 그립니다.
    ctx.drawImage(sheet, sx, sy, swSheet, shSheet, cx - dw / 2, cy - dh / 2, dw, dh)
    return
  }

  // 시트 안에는 “누운” 직사각형(swSheet×shSheet)으로 들어 있으므로,
  // 화면 중심에서 반시계 90° 돌린 뒤 그 영역을 붙이면 세로로 선 토끼(dh×dw)가 됩니다.
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-Math.PI / 2)
  ctx.drawImage(sheet, sx, sy, swSheet, shSheet, -dh / 2, -dw / 2, dh, dw)
  ctx.restore()
}

export default function BunnyRunLoader({
  message = '열심히 달려가는 중!',
  className = '',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  /** 이미지·JSON이 모두 준비되면 true — 그 전에는 토끼 대신 짧은 안내를 보여줍니다. */
  const [ready, setReady] = useState(false)
  /** PNG/JSON 요청이 실패하면 true — 예전처럼 싹 이모지로 대체합니다. */
  const [loadError, setLoadError] = useState(false)
  const atlasRef = useRef<BunnyRunAtlas | null>(null)
  const sheetRef = useRef<HTMLImageElement | null>(null)
  const keysRef = useRef<string[]>([])
  /** 애니메이션 타임라인 시작 시각 — requestAnimationFrame 으로 경과 시간을 잽니다. */
  const animStartRef = useRef(0)

  // JSON + PNG 병렬 로드
  useEffect(() => {
    let cancelled = false

    async function load() {
      const [jsonRes, img] = await Promise.all([
        fetch(ATLAS_JSON_URL),
        new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image()
          el.onload = () => resolve(el)
          el.onerror = () => reject(new Error('bunny_run.png 로드 실패'))
          el.src = SHEET_IMAGE_URL
        }),
      ])

      if (!jsonRes.ok) {
        throw new Error('bunny_run.json 응답 오류')
      }
      const atlas = (await jsonRes.json()) as BunnyRunAtlas
      if (cancelled) return

      atlasRef.current = atlas
      sheetRef.current = img
      keysRef.current = orderedFrameKeys(atlas.frames)
      setReady(true)
    }

    load().catch(() => {
      if (!cancelled) {
        setReady(false)
        setLoadError(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  // 프레임 인덱스 순환 + 캔버스에 그리기
  useEffect(() => {
    if (!ready || loadError) return

    const canvas = canvasRef.current
    const atlas = atlasRef.current
    const sheet = sheetRef.current
    const keys = keysRef.current
    if (!canvas || !atlas || !sheet || keys.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { mw, mh } = maxSourceSize(atlas.frames, keys)
    const canvasW = mw
    const canvasH = mh
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    canvas.width = Math.round(canvasW * dpr)
    canvas.height = Math.round(canvasH * dpr)
    canvas.style.width = `${DISPLAY_CSS_W}px`
    canvas.style.height = `${DISPLAY_CSS_H}px`

    animStartRef.current = performance.now()

    const paint = (now: number) => {
      const elapsed = now - animStartRef.current
      const n = keys.length
      /** 지금이 몇 번째 “발자국” 칸인지 — 이 값이 바뀔 때마다 주 프레임이 바뀝니다. */
      const cell = Math.floor(elapsed / FRAME_CELL_MS)
      /** 한 칸 안에서의 진행도(0 ~ FRAME_CELL_MS) — 끝부분에서만 크로스페이드합니다. */
      const local = elapsed - cell * FRAME_CELL_MS
      const curKey = keys[cell % n]
      const nextKey = keys[(cell + 1) % n]
      const curEntry = atlas.frames[curKey]
      const nextEntry = atlas.frames[nextKey]

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
      ctx.imageSmoothingEnabled = true
      ctx.clearRect(0, 0, canvasW, canvasH)

      if (local < FRAME_HOLD_MS || CROSSFADE_MS <= 0) {
        // 아직 다음 자세로 넘어가기 전 — 현재 프레임만 선명하게 그립니다.
        ctx.globalAlpha = 1
        drawFrame(ctx, sheet, curEntry, canvasW, canvasH)
      } else {
        // 끝 구간: 이전 자세는 서서히 사라지고, 다음 자세가 서서히 드러납니다.
        const rawMix = (local - FRAME_HOLD_MS) / CROSSFADE_MS
        const mix = smoothstep01(rawMix)
        ctx.globalAlpha = 1 - mix
        drawFrame(ctx, sheet, curEntry, canvasW, canvasH)
        ctx.globalAlpha = mix
        drawFrame(ctx, sheet, nextEntry, canvasW, canvasH)
        ctx.globalAlpha = 1
      }
    }

    let raf = 0
    const loop = (now: number) => {
      paint(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(raf)
  }, [ready, loadError])

  return (
    <div
      className={`flex flex-col items-center gap-3 ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy={!loadError}
    >
      {loadError ? (
        <div
          className="flex items-center justify-center text-5xl"
          style={{ width: DISPLAY_CSS_W, height: DISPLAY_CSS_H }}
        >
          <span className="animate-bounce" aria-hidden>
            🌱
          </span>
        </div>
      ) : (
        <>
          {/* 캔버스: 스프라이트 시트에서 현재 프레임만 잘라 보여 줍니다. 고정 박스로 레이아웃 흔들림을 줄입니다. */}
          <div
            className={`flex items-center justify-center ${ready ? 'opacity-100' : 'opacity-0'}`.trim()}
            style={{ width: DISPLAY_CSS_W, height: DISPLAY_CSS_H }}
          >
            <canvas ref={canvasRef} className="block max-h-full max-w-full" aria-hidden />
          </div>

          {!ready ? (
            <p className="text-xs font-semibold text-gray-400">토끼 준비 중…</p>
          ) : null}
        </>
      )}

      <p className="text-sm font-bold text-gray-400">{message}</p>
    </div>
  )
}
