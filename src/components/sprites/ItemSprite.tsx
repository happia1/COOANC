import SpriteImage from '@/components/common/SpriteImage'
import {
  PIGGY_BANK, SHOP_ANIMATIONS, MARKET_ITEMS,
  type PiggyBankFrameName,
  type ShopAnimFrameName,
  type MarketItemFrameName,
} from '@/constants/sprites'
import type { CSSProperties } from 'react'

export type { PiggyBankFrameName, ShopAnimFrameName, MarketItemFrameName }

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
  frame: MarketItemFrameName
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
}

export function MarketItemSprite({ frame, ...rest }: MarketItemSpriteProps) {
  return <SpriteImage sheet={MARKET_ITEMS} frame={frame} {...rest} />
}
