import SpriteImage from '@/components/common/SpriteImage'
import MarketItemImage from '@/components/common/MarketItemImage'
import { PIGGY_BANK, SHOP_ANIMATIONS } from '@/constants/sprites'
import type { MarketItemImageKey } from '@/constants/marketItemImages'
import type { PiggyBankFrameName, ShopAnimFrameName } from '@/constants/sprites'
import type { CSSProperties } from 'react'

export type { PiggyBankFrameName, ShopAnimFrameName }
/** 예전 이름 호환 — 마켓 PNG 키와 동일합니다 */
export type MarketItemFrameName = MarketItemImageKey

interface PiggyBankSpriteProps {
  frame: PiggyBankFrameName
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
}

export function PiggyBankSprite({ frame, ...rest }: PiggyBankSpriteProps) {
  return <SpriteImage sheet={PIGGY_BANK} frame={frame} {...rest} />
}

interface ShopAnimSpriteProps {
  frame: ShopAnimFrameName
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
}

export function ShopAnimSprite({ frame, ...rest }: ShopAnimSpriteProps) {
  return <SpriteImage sheet={SHOP_ANIMATIONS} frame={frame} {...rest} />
}

interface MarketItemSpriteProps {
  frame: MarketItemImageKey
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
}

/** 마켓 상품 기본 그림 — `items/shop/items/*.png` 단일 파일 */
export function MarketItemSprite({ frame, ...rest }: MarketItemSpriteProps) {
  return <MarketItemImage frame={frame} {...rest} />
}
