/**
 * PostCSS 설정입니다.
 * 빌드할 때 CSS를 가공하는 도구들의 목록입니다.
 * - tailwindcss: Tailwind 유틸리티 클래스를 실제 CSS로 만듭니다.
 * - autoprefixer: 브라우저마다 필요한 벤더 프리픽스(-webkit- 등)를 자동으로 붙입니다.
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
