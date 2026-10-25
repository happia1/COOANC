'use client'

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-bold text-gray-700">서버에 잠시 연결하지 못했어요.</p>
      <p className="text-sm text-gray-500">잠시 후 다시 불러와 주세요.</p>
      <button type="button" onClick={reset} className="rounded-xl bg-brand-blue px-5 py-3 font-bold text-white">
        다시 불러오기
      </button>
    </div>
  )
}
