/**
 * 지갑 PNG 캐시 버스트 버전 — `src/lib/walletStages.ts` 의 WALLET_IMAGE_CACHE_BUST 와 **반드시 동일**해야 합니다.
 * 지갑 그림 파일을 교체했는데도 예전 그림이 보이면 이 숫자(양쪽)를 1 올리세요.
 */
const WALLET_IMAGE_CACHE_BUST = '4'

/**
 * 마켓 상단 지붕 PNG 캐시 버스트 — `src/components/child/MarketTab.tsx` 의 `MARKET_ROOF_CACHE_BUST` 와 **동일**해야 합니다.
 * (지붕 파일만 갈아끼웠는데 옛 그림이 보이면 양쪽 숫자를 같이 1 올리세요.)
 */
const MARKET_ROOF_CACHE_BUST = '2'

/** @type {import('next').NextConfig} */
const nextConfig = {
  /** 예전 디바이스 모드 설정 URL(/setup) — 라우트 파일 제거 후 루트로 보냄 */
  async redirects() {
    return [{ source: '/setup', destination: '/', permanent: false }]
  },
  images: {
    /**
     * Next.js 16: `localPatterns` 를 쓰면 **여기 적힌 경로만** `next/image` 로 불러올 수 있습니다.
     * - 쿼리가 있는 로컬 URL(캐시 끊기용 `?v=`)은 패턴마다 허용할 `search` 를 정확히 적어야 합니다.
     * - 쿼리 없는 정적 파일은 `search: ''` 로 public·`/assets/**`·루트 로고 등을 허용합니다.
     */
    localPatterns: [
      {
        pathname: '/assets/img/items/rewards/wallet/**',
        search: `?v=${WALLET_IMAGE_CACHE_BUST}`,
      },
      {
        pathname: '/assets/img/layouts/backgrounds/market_roof.png',
        search: `?v=${MARKET_ROOF_CACHE_BUST}`,
      },
      {
        pathname: '/assets/**',
        search: '',
      },
      {
        pathname: '/COOANC_Logo.png',
        search: '',
      },
    ],
  },
}

export default nextConfig
