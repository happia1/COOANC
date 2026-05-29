'use client'

/**
 * 공지 본문(body)을 마크다운으로 보여 주는 공통 컴포넌트입니다. (STEP 4)
 *
 * 비개발자 설명:
 * - 관리자가 공지에 적은 글에서 "# 제목", "- 목록", "**굵게**", "[링크](주소)",
 *   줄바꿈 등을 사람이 보기 좋은 모양으로 바꿔 줍니다.
 * - (원래 명령문에는 Flutter용 flutter_markdown 이 적혀 있었지만, 이 프로젝트는
 *   웹앱이라 웹 표준인 react-markdown 으로 동일 기능을 구현했습니다.)
 * - 보안: 기본 설정상 글 안의 위험한 HTML 은 실행되지 않습니다(안전).
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

type Props = {
  /** 마크다운 원문 */
  children: string
  /** 바깥 컨테이너에 더 줄 클래스(글자 크기/색 등) */
  className?: string
}

/**
 * 태그별 Tailwind 스타일 매핑.
 * 공지 카드 안에서 작고 단정하게 보이도록 크기를 작게 잡았습니다.
 */
const markdownComponents: Components = {
  h1: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-black text-gray-900 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h4 className="mb-1 mt-2 text-[13px] font-extrabold text-gray-900 first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="mb-1 mt-2 text-xs font-extrabold text-gray-800 first:mt-0">{children}</h5>,
  p: ({ children }) => <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-black text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-1.5 list-inside list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-inside list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-bold text-[#4A90E2] underline underline-offset-2"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-gray-200 pl-3 text-gray-500">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-gray-100 px-1 py-0.5 text-[0.9em] text-gray-800">{children}</code>
  ),
  hr: () => <hr className="my-2 border-gray-100" />,
}

export default function NoticeMarkdown({ children, className }: Props) {
  return (
    <div className={`text-[11px] text-gray-600 ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
