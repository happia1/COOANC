'use client'

/**
 * EmotionCardLockedModal
 * 감정카드 기능 잠금 팝업 (Lv.10 해금 예정)
 *
 * 현재 상태: 미구현 — 잠금 UI만 표시
 * 정식 출시 시 EmotionCardModal로 교체 예정
 *
 * 에셋 경로 (디자인 완료 후 추가):
 *   /assets/emotion/faces/   — 표정 PNG
 *   /assets/emotion/shapes/  — 모양 PNG
 *   /assets/emotion/colors   — hex 상수 파일
 *
 * 플로우:
 *   STEP1 표정 선택 → STEP2 모양 선택 → STEP3 색상 선택
 *   → 중앙 실시간 합성 → 달력 저장
 */

type Props = {
  open: boolean
  onClose: () => void
}

function DummySlideStrip({ stepLabel, caption }: { stepLabel: string; caption: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-wide text-white/40">{stepLabel}</p>
      <p className="mb-1 text-[10px] font-bold text-white/50">{caption}</p>
      <div className="flex items-center justify-center gap-1.5 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-9 w-9 shrink-0 rounded-full bg-white/20 ${i === 2 ? 'ring-2 ring-white/30 ring-offset-1 ring-offset-transparent' : ''}`}
            aria-hidden
          />
        ))}
      </div>
    </div>
  )
}

export default function EmotionCardLockedModal({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[260]"
      role="dialog"
      aria-modal="true"
      aria-label="내 감정 카드 — 준비 중"
    >
      {/* 어둡게 + 블러 — 뒤 화면이 흐릿하게 보이도록 */}
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
        aria-label="닫기"
        onClick={onClose}
      />

      {/* 화면 정중앙 — 정식 반영 예정 안내 */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
        <p className="max-w-xs text-center text-xl font-black leading-snug text-white drop-shadow-lg sm:text-2xl">
          정식 앱버전 반영 예정
        </p>
      </div>

      <div className="relative flex h-full min-h-0 flex-col justify-between px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-sm text-center">
          <h2 className="text-lg font-black text-white/90 drop-shadow-sm">내 감정 카드</h2>
          <p className="mt-1.5 text-sm font-semibold leading-relaxed text-white/60">
            표정, 모양, 색깔로 오늘의 기분을 만들어봐요!
          </p>

          {/*
            미리보기 더미 — 실제 기능 대신 3단계 플로우만 흐릿하게
            (표정 → 모양 → 색상 → 중앙 합성 프리뷰)
          */}
          <div
            className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 p-3 opacity-30 grayscale pointer-events-none select-none"
            aria-hidden
          >
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/25 ring-4 ring-white/10" />
            <div className="flex flex-col gap-2.5">
              <DummySlideStrip stepLabel="STEP1" caption="표정 선택" />
              <DummySlideStrip stepLabel="STEP2" caption="모양 선택" />
              <DummySlideStrip stepLabel="STEP3" caption="색상 선택" />
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm pb-2 pt-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-white/15 py-2.5 text-sm font-black text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors active:bg-white/25"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
