/**
 * 지갑 PNG 캐시 버스트 버전 — `src/lib/walletStages.ts` 의 WALLET_IMAGE_CACHE_BUST 와 **반드시 동일**해야 합니다.
 * 지갑 그림 파일을 교체했는데도 예전 그림이 보이면 이 숫자(양쪽)를 1 올리세요.
 */
const WALLET_IMAGE_CACHE_BUST = '4'

/**
 * 마켓 상단 지붕 PNG 캐시 버스트 — `src/components/child/MarketTab.tsx` 의 `MARKET_ROOF_CACHE_BUST` 와 **동일**해야 합니다.
 * (지붕 파일만 갈아끼웠는데 옛 그림이 보이면 양쪽 숫자를 같이 1 올리세요.)
 */
const MARKET_ROOF_CACHE_BUST = '3'

/**
 * Supabase Storage 공개 URL — `store_items.image_url` 이 이 호스트 아래로 올 때 `next/image` 최적화 허용
 * (프로젝트마다 서브도메인이 달라 env 의 URL 에서 hostname 만 뽑습니다.)
 */
function supabaseStorageRemotePatterns() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return []
  try {
    const u = new URL(raw)
    const protocol = u.protocol.replace(':', '') === 'http' ? 'http' : 'https'
    return [
      {
        protocol,
        hostname: u.hostname,
        port: u.port || '',
        pathname: '/storage/v1/object/public/**',
        search: '',
      },
    ]
  } catch {
    return []
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  /** 예전 디바이스 모드 설정 URL(/setup) — 라우트 파일 제거 후 루트로 보냄 */
  async redirects() {
    return [{ source: '/setup', destination: '/', permanent: false }]
  },
  /**
   * 정적 에셋 캐시:
   * - `animations.json` 포함 `/assets/**` 는 파일명/버전 쿼리가 바뀔 때만 교체되도록 immutable 캐시를 줍니다.
   */
  async headers() {
    return [
      {
        source: '/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  images: {
    /** AVIF·WebP 우선 제공 — 대역폭·디코딩 시간 절약 */
    formats: ['image/avif', 'image/webp'],
    /** 정적 이미지 중간 캐시(초) — CDN·브라우저가 오래 재사용 */
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: supabaseStorageRemotePatterns(),
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
        pathname: '/assets/img/layouts/backgrounds/market_roof_.png',
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
