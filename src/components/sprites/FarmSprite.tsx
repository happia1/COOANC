import SpriteImage from '@/components/common/SpriteImage'
import {
  FARM_CAT, FARM_CHICKEN, FARM_COW, FARM_DOG, FARM_HORSE, FARM_PIGGY, FARM_SHEEP,
  type FarmCatFrameName,
  type FarmChickenFrameName,
  type FarmCowFrameName,
  type FarmDogFrameName,
  type FarmHorseFrameName,
  type FarmPiggyFrameName,
  type FarmSheepFrameName,
} from '@/constants/sprites'
import type { CSSProperties } from 'react'

export type FarmAnimal = 'cat' | 'chicken' | 'cow' | 'dog' | 'horse' | 'piggy' | 'sheep'
export type FarmFrameName =
  | FarmCatFrameName
  | FarmChickenFrameName
  | FarmCowFrameName
  | FarmDogFrameName
  | FarmHorseFrameName
  | FarmPiggyFrameName
  | FarmSheepFrameName

const SHEETS = {
  cat:     FARM_CAT,
  chicken: FARM_CHICKEN,
  cow:     FARM_COW,
  dog:     FARM_DOG,
  horse:   FARM_HORSE,
  piggy:   FARM_PIGGY,
  sheep:   FARM_SHEEP,
}

interface FarmSpriteProps {
  animal: FarmAnimal
  frame: FarmFrameName
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
}

export function FarmSprite({ animal, frame, ...rest }: FarmSpriteProps) {
  return <SpriteImage sheet={SHEETS[animal]} frame={frame} {...rest} />
}
