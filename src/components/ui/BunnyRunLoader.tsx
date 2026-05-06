'use client'

/**
 * COOANC 로딩 화면용 토끼 달리기 애니메이션입니다.
 *
 * - `public/assets/img/characters/onboarding/bunny_run.png` 한 장(스프라이트 시트)과
 * - TexturePacker가 보낸 `bunny_run.json` 을 읽어,
 *   프레임마다 잘린 영역을 캔버스에 그립니다.
 * - 일부 프레임은 시트 안에서 90° 돌아가 저장되어 있어(`rotated: true`),
 *   그릴 때 반대로 회전해 원래 모습으로 되돌립니다.
 * - 프레임은 한 장씩만 그립니다. 두 장을 반투명으로 겹치면(크로스페이드) 가장자리가 매 프레임 섞이며 “반짝”이는 경우가 많아 제거했습니다.
 * - 캔버스는 매 프레임 투명으로 비워 부모(`ASSETS.layouts.sharedAppBackground` 등) 배경이 비치게 하고, 그릴 위치는 픽셀 정수로 맞춥니다.
 * - 토끼 아래에는 기존과 같이 가로 로딩 막대만 두고, 선택 문구(`statusMessage`)는 막대 **아래**에 둡니다.
 *   `progressPercent`를 주면 그 값(0~100)을 쓰고, 없으면 에셋 로드 전·후 경과로 추정해 “진행 중” 느낌을 줍니다.
 * - `role="status"`·막대의 `role="progressbar"`로 보조 기기에 로딩 중임을 알립니다.
 */

import { useEffect, useRef, useState } from 'react'

/** public 폴더 기준 URL — 브라우저에서 그대로 요청합니다. */
const ATLAS_JSON_URL = '/assets/img/characters/onboarding/bunny_run.json'
const SHEET_IMAGE_URL = '/assets/img/characters/onboarding/bunny_run.png'

/** 한 장의 스프라이트를 보여 주는 시간(ms) — 줄이면 더 빨리 달립니다. */
const FRAME_CELL_MS = 120

/** 화면에 보이는 캔버스 박스(px) — 토끼 표시를 더 작게(기존 100×190 대비 절반). */
const DISPLAY_CSS_W = 50
const DISPLAY_CSS_H = 95

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

type Props = {
  /** 바깥 컨테이너에 Tailwind 등을 더할 때 사용합니다. */
  className?: string
  /**
   * 0~100 진행률(상위에서 알 때만 전달). 생략 시 내부 추정(토끼 PNG·JSON 로드 전 구간,
   * 로드 후에도 앱 준비가 끝날 때까지 천천히 올라가되 100%에는 고정하지 않음).
   */
  progressPercent?: number
  /**
   * 진행 막대 **아래**에 보여 줄 짧은 안내 문구입니다.
   * 예: 부모 앱에서 자녀 화면으로 넘어갈 때 「무엇을 기다리는지」를 알려 줍니다.
   */
  statusMessage?: string
}

/**
 * 달리는 토끼 바로 아래 가로 막대 — 비개발자: 회색 통 안에서 핑크 막대가 길어질수록 진행된 것처럼 보입니다.
 * 스크린 리더는 `progressbar`로 읽습니다.
 */
function LoadingProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent))
  return (
    <div
      className="h-1.5 w-full max-w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-full bg-black/10 shadow-sm ring-1 ring-black/5"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label="로딩 진행 표시"
    >
      <div
        className="h-full rounded-full bg-pink-500 transition-[width] duration-200 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
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
    // 목적지 좌표·크기를 정수 픽셀로 맞춰 브라우저가 매 프레임 다른 소수점에 얹을 때 생기는 번짐을 줄입니다.
    const dx = Math.round(cx - dw / 2)
    const dy = Math.round(cy - dh / 2)
    const rw = Math.round(dw)
    const rh = Math.round(dh)
    ctx.drawImage(sheet, sx, sy, swSheet, shSheet, dx, dy, rw, rh)
    return
  }

  // 시트 안에는 “누운” 직사각형(swSheet×shSheet)으로 들어 있으므로,
  // 화면 중심에서 반시계 90° 돌린 뒤 그 영역을 붙이면 세로로 선 토끼(dh×dw)가 됩니다.
  const rdx = Math.round(dh)
  const rdy = Math.round(dw)
  ctx.save()
  ctx.translate(Math.round(cx), Math.round(cy))
  ctx.rotate(-Math.PI / 2)
  ctx.drawImage(sheet, sx, sy, swSheet, shSheet, Math.round(-dh / 2), Math.round(-dw / 2), rdx, rdy)
  ctx.restore()
}

export default function BunnyRunLoader({
  className = '',
  progressPercent: progressPercentProp,
  statusMessage,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  /** 이미지·JSON이 모두 준비되면 true — 그 전에는 캔버스 영역을 비워 두고 투명하게 둡니다. */
  const [ready, setReady] = useState(false)
  /** PNG/JSON 요청이 실패하면 true — 예전처럼 싹 이모지로 대체합니다. */
  const [loadError, setLoadError] = useState(false)
  const atlasRef = useRef<BunnyRunAtlas | null>(null)
  const sheetRef = useRef<HTMLImageElement | null>(null)
  const keysRef = useRef<string[]>([])
  /** 애니메이션 타임라인 시작 시각 — requestAnimationFrame 으로 경과 시간을 잽니다. */
  const animStartRef = useRef(0)
  /** 클라이언트에서 이 컴포넌트가 붙은 시각 — SSR/하이드레이션 불일치를 피하려고 마운트 후에만 채웁니다. */
  const mountMsRef = useRef<number | null>(null)
  /** 토끼 PNG·JSON이 모두 끝난 시각 — 그 이후 구간의 막대 채움에 씁니다. */
  const assetsReadyAtRef = useRef<number | null>(null)
  /** 외부에서 진행률을 안 줄 때, 막대를 주기적으로 다시 그리기 위한 틱입니다. */
  const [, setProgressTick] = useState(0)

  // JSON + PNG 병렬 로드
  useEffect(() => {
    let cancelled = false
    // 초기 SSR HTML과 첫 클라이언트 렌더 HTML을 같게 유지하기 위해, 시간 기준점은 이 시점에 기록합니다.
    mountMsRef.current = performance.now()

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
      const atlasText = await jsonRes.text()
      let atlas: BunnyRunAtlas
      try {
        atlas = JSON.parse(atlasText) as BunnyRunAtlas
      } catch {
        throw new Error('bunny_run.json 형식 오류')
      }
      if (cancelled) return

      atlasRef.current = atlas
      sheetRef.current = img
      keysRef.current = orderedFrameKeys(atlas.frames)
      assetsReadyAtRef.current = performance.now()
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

  // 외부 진행률이 없을 때만: 막대가 시간에 따라 천천히 차 보이게 합니다(실제 라우팅 완료와 무관한 추정치).
  useEffect(() => {
    if (progressPercentProp !== undefined) return
    const id = window.setInterval(() => setProgressTick((n) => n + 1), 120)
    return () => window.clearInterval(id)
  }, [progressPercentProp])

  /** 0~100 — `progressPercent` prop이 있으면 그대로, 없으면 마운트·에셋 준비 시각 기준 추정. */
  const shownProgressPercent =
    progressPercentProp !== undefined
      ? Math.min(100, Math.max(0, progressPercentProp))
      : (() => {
          // 아직 마운트 이펙트가 돌기 전(SSR + 첫 하이드레이션 렌더)은 0으로 고정해 마크업 불일치를 막습니다.
          if (mountMsRef.current === null) return 0
          const now = performance.now()
          const sinceMount = now - mountMsRef.current
          if (!ready) {
            // 에셋 받기 전: 약 1초 안에 0→35% 정도로만 올려 “기다리는 중”을 표시합니다.
            return Math.min(35, sinceMount / 28)
          }
          const t0 = assetsReadyAtRef.current ?? now
          const sinceAssets = now - t0
          // 에셋 이후: 천천히 38%→90%까지(100%는 “완료”에 가까워 오해를 줄이기 위해 안 씀).
          return Math.min(90, 38 + sinceAssets / 70)
        })()

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
      // rAF 시각(now)이 아주 잠깐 animStartRef보다 작을 수 있어 elapsed가 음수가 되면,
      // JS의 음수 % 연산(-1 % 6 === -1) 때문에 keys[-1]이 되어 entry가 undefined로 터집니다.
      const elapsedRaw = now - animStartRef.current
      const elapsed = Math.max(0, elapsedRaw)
      const n = keys.length
      /** 지금이 몇 번째 “발자국” 칸인지 — 이 값이 바뀔 때마다 한 장의 스프라이트가 바뀝니다. */
      const cell = Math.floor(elapsed / FRAME_CELL_MS)
      // 음수 cell이 생기지 않도록 elapsed를 위에서 막았고, % 보정으로 인덱스를 항상 [0, n)에 둡니다.
      const curIdx = ((cell % n) + n) % n
      const curKey = keys[curIdx]
      const curEntry = atlas.frames[curKey]

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // 부모 div에 깔린 배경 이미지가 비치도록 이전 프레임을 지웁니다(단색 채움은 배경을 가립니다).
      ctx.clearRect(0, 0, canvasW, canvasH)

      // 한 장만 그립니다. 두 장을 알파로 겹치면 가장자리가 매 프레임 섞여 반짝이는 현상이 잘 납니다.
      drawFrame(ctx, sheet, curEntry, canvasW, canvasH)
    }

    let raf = 0
    const loop = (now: number) => {
      paint(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(raf)
  }, [ready, loadError])

  /** 스크린 리더용: 문구가 있으면 그걸 우선 읽고, 없으면 일반 「로딩 중」 라벨을 씁니다. */
  const statusAriaLabel = statusMessage?.trim() ? statusMessage.trim() : '로딩 중'

  return (
    <div
      className={`flex flex-col items-center gap-3 ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy={!loadError}
      aria-label={statusAriaLabel}
    >
      {loadError ? (
        <>
          <div
            className="flex items-center justify-center text-5xl"
            style={{ width: DISPLAY_CSS_W, height: DISPLAY_CSS_H }}
          >
            <span className="animate-bounce" aria-hidden>
              🌱
            </span>
          </div>
          {/** PNG/JSON 실패 시에는 막대 대신 이모지만 쓰므로, 문구는 그 아래에 둡니다. */}
          {statusMessage?.trim() ? (
            <p className="max-w-[min(20rem,calc(100vw-2rem))] px-2 text-center text-sm font-semibold text-gray-800 drop-shadow-sm">
              {statusMessage.trim()}
            </p>
          ) : null}
        </>
      ) : (
        <>
          {/**
           * 스프라이트 PNG·JSON을 받기 전: 옛날에는 이 구간 전체를 투명(opacity-0) 처리해
           * 로딩이 짧으면 토끼만 안 보이고 막대만 보이는 일이 있었습니다.
           * 같은 크기 박스 안에 짧은 토끼 플레이스홀더를 두고, 준비되면 캔버스로 갈아탑니다.
           */}
          <div
            className="flex items-center justify-center"
            style={{ width: DISPLAY_CSS_W, height: DISPLAY_CSS_H }}
          >
            {!ready ? (
              <span className="text-3xl animate-bounce select-none" aria-hidden>
                🐰
              </span>
            ) : (
              <canvas
                ref={canvasRef}
                className="block max-h-full max-w-full"
                style={{ transform: 'translateZ(0)' }}
                aria-hidden
              />
            )}
          </div>
          {/** 기존과 동일: 토끼 바로 아래 가로 진행 막대(스타일·동작 변경 없음). */}
          <LoadingProgressBar percent={shownProgressPercent} />
          {/** 막대 아래에만 안내 문구를 추가합니다. */}
          {statusMessage?.trim() ? (
            <p className="max-w-[min(20rem,calc(100vw-2rem))] px-2 text-center text-sm font-semibold text-gray-800 drop-shadow-sm">
              {statusMessage.trim()}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
