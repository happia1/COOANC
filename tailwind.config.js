/**
 * Tailwind CSS 설정 파일입니다.
 * - content: 어떤 파일 안의 클래스 이름을 스캔할지 정합니다. 여기에 없는 파일은 Tailwind가 무시합니다.
 * - theme.extend: 기본 테마를 덮어쓰지 않고, 색·간격 등을 추가로 확장할 때 사용합니다.
 * - plugins: 공식/서드파티 플러그인을 넣는 자리입니다.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./public/**/*.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
