'use client'

/**
 * 자녀 화면에서 서버 조회가 실패했을 때 보여 주는 안내 화면입니다.
 *
 * 비개발자 설명(신고된 문제):
 *   서버가 느려서 데이터를 못 받아오면, 예전에는 그냥 **빈 값으로 화면이 그려졌습니다.**
 *   그래서 캐릭터가 기본 토끼로 바뀌고 미션 카드도 사라져, 아이 데이터가 지워진 것처럼
 *   보였습니다(실제로는 지워지지 않았습니다).
 *   이제는 이 화면을 띄우고 「다시 불러오기」로 복구하게 합니다.
 */

import { useEffect } from 'react'

export default function ChildRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[child route error]', error)
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#FFF8EC] px-6 text-center">
      <span className="text-5xl" aria-hidden>
        🐣
      </span>
      <p className="text-lg font-black leading-snug text-brand-text">
        잠깐만요!
        <br />
        정보를 불러오지 못했어요.
      </p>
      <p className="text-sm font-bold leading-relaxed text-gray-500">
        인터넷이 느리거나 잠시 문제가 생겼어요.
        <br />
        <span className="text-gray-400">모은 크레딧과 미션은 그대로 있어요.</span>
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-1 w-full max-w-xs rounded-2xl bg-amber-400 py-3.5 text-base font-black text-gray-900 shadow-md active:scale-[0.98]"
      >
        다시 불러오기
      </button>
      <a
        href="/login"
        className="text-xs font-bold text-gray-400 underline underline-offset-2"
      >
        로그인 화면으로
      </a>
    </div>
  )
}
