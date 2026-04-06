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
    extend: {
      keyframes: {
        /** 마켓 배달: 상품이 낙하산처럼 위에서 아래로 내려오는 연출 */
        marketParachuteDrop: {
          '0%': { transform: 'translateY(-55vh) translateX(-12px) scale(0.88)', opacity: '0' },
          '12%': { opacity: '1' },
          '100%': { transform: 'translateY(0) translateX(0) scale(1)', opacity: '1' },
        },
        /** 배달 오토바이 플로팅 아이콘: 살짝 위아래로 떠 있는 느낌 */
        marketMotoBob: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'market-parachute': 'marketParachuteDrop 2.4s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'market-moto': 'marketMotoBob 1.8s ease-in-out infinite',
      },
      colors: {
        brand: {
          blue:   '#4A90E2',
          green:  '#7ED321',
          yellow: '#F8E71C',
          gray:   '#F5F5F5',
          text:   '#333333',
        },
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
