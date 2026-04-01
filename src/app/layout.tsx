/**
 * 앱 전체를 감싸는 루트 레이아웃입니다.
 * - globals.css: Tailwind와 전역 스타일을 한 번만 불러와 모든 페이지에 적용합니다.
 */
import './globals.css'
import React from 'react'

/**
 * children: 각 페이지(화면)의 내용이 여기로 들어갑니다.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
