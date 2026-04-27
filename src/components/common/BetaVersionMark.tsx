/**
 * COOANC가 아직 베타(시험) 단계임을 알리는 아주 작은 텍스트입니다.
 * 로고 바로 위에 두어 시각적 부담 없이만 표시합니다.
 */
export function BetaVersionMark({ className = '' }: { className?: string }) {
  return (
    <p
      className={`text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 ${className}`}
      aria-label="베타 버전 서비스"
    >
      Beta
    </p>
  )
}
