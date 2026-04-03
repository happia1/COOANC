/**
 * 앱 전체 루트 레이아웃입니다.
 * - globals.css: Tailwind 레이어(base/components/utilities)를 전역 적용합니다.
 * - metadata: 브라우저 탭 제목, SEO 설명, PWA 매니페스트·아이콘 경로를 Next에 알려 줍니다.
 */
import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'COOANC - 아이의 올바른 경제 습관',
  description: '미션을 수행하고 크레딧을 모으며 배우는 경제 교육 서비스',
  manifest: '/site.webmanifest', // 매니페스트 연결
  icons: {
    icon: [
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    title: 'COOANC',
    capable: true,
    statusBarStyle: 'default',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
