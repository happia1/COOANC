/** @type {import('next').NextConfig} */
const nextConfig = {
  /** 예전 디바이스 모드 설정 URL(/setup) — 라우트 파일 제거 후 루트로 보냄 */
  async redirects() {
    return [{ source: '/setup', destination: '/', permanent: false }]
  },
}

export default nextConfig
