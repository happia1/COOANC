// Auto-generated from TexturePacker JSON files
// Frame keys do NOT include .png extension

export interface SpriteFrame {
  x: number
  y: number
  w: number
  h: number
  rotated: boolean
}

export interface SpriteSheet {
  image: string       // path relative to /assets/img/
  atlasW: number
  atlasH: number
  frames: Record<string, SpriteFrame>
}

// ─── characters/base ───────────────────────────────────────────────

export const BEARS: SpriteSheet = {
  image: 'characters/base/bears.png',
  atlasW: 829,
  atlasH: 560,
  frames: {
    'Bears (1)': { x: 333, y: 1,   w: 280, h: 495, rotated: true  },
    'Bears (2)': { x: 1,   y: 1,   w: 330, h: 558, rotated: false },
    'Bears (3)': { x: 333, y: 283, w: 238, h: 495, rotated: true  },
  },
}

export const BUNNY: SpriteSheet = {
  image: 'characters/base/bunny.png',
  atlasW: 253,
  atlasH: 1623,
  frames: {
    '레이어 19': { x: 1, y: 546,  w: 243, h: 537, rotated: false },
    '레이어 20': { x: 1, y: 1085, w: 241, h: 537, rotated: false },
    '레이어 21': { x: 1, y: 1,    w: 251, h: 543, rotated: false },
  },
}

export const CHICKS: SpriteSheet = {
  image: 'characters/base/chicks.png',
  atlasW: 915,
  atlasH: 483,
  frames: {
    'chics (1)': { x: 612, y: 1, w: 302, h: 480, rotated: false },
    'chics (2)': { x: 1,   y: 1, w: 292, h: 481, rotated: false },
    'chics (3)': { x: 295, y: 1, w: 315, h: 480, rotated: false },
  },
}

export const FOX: SpriteSheet = {
  image: 'characters/base/fox.png',
  atlasW: 868,
  atlasH: 444,
  frames: {
    'fox(1)': { x: 1,   y: 1, w: 329, h: 439, rotated: false },
    'fox(2)': { x: 332, y: 1, w: 293, h: 441, rotated: false },
    'fox(3)': { x: 627, y: 1, w: 240, h: 442, rotated: false },
  },
}

export const HAMSTER: SpriteSheet = {
  image: 'characters/base/hamster.png',
  atlasW: 298,
  atlasH: 1619,
  frames: {
    'hams (1)': { x: 1, y: 541,  w: 292, h: 538, rotated: false },
    'hams (2)': { x: 1, y: 1081, w: 292, h: 537, rotated: false },
    'hams (3)': { x: 1, y: 1,    w: 296, h: 538, rotated: false },
  },
}

export const OTTER: SpriteSheet = {
  image: 'characters/base/otter.png',
  atlasW: 939,
  atlasH: 543,
  frames: {
    'Otter (1)': { x: 1,   y: 1, w: 325, h: 541, rotated: false },
    'Otter (2)': { x: 665, y: 1, w: 273, h: 515, rotated: false },
    'Otter (3)': { x: 328, y: 1, w: 335, h: 515, rotated: false },
  },
}

// ─── characters/onboarding ─────────────────────────────────────────

export const BUNNY_RUN: SpriteSheet = {
  image: 'characters/onboarding/bunny_run.png',
  atlasW: 684,
  atlasH: 510,
  frames: {
    'bunny_run (1)': { x: 343, y: 167, w: 140, h: 342, rotated: false },
    'bunny_run (2)': { x: 1,   y: 346, w: 156, h: 340, rotated: true  },
    'bunny_run (3)': { x: 485, y: 167, w: 166, h: 341, rotated: false },
    'bunny_run (4)': { x: 343, y: 1,   w: 164, h: 340, rotated: true  },
    'bunny_run (5)': { x: 159, y: 1,   w: 152, h: 343, rotated: false },
    'bunny_run (6)': { x: 1,   y: 1,   w: 156, h: 343, rotated: false },
  },
}

// ─── common/ui ─────────────────────────────────────────────────────

export const ICONS: SpriteSheet = {
  image: 'common/ui/icons.png',
  atlasW: 226,
  atlasH: 825,
  frames: {
    'bag':             { x: 95,  y: 172, w: 85,  h: 100, rotated: true  },
    'bunch_of_flowers':{ x: 3,   y: 261, w: 89,  h: 117, rotated: true  },
    'credit':          { x: 102, y: 449, w: 93,  h: 97,  rotated: true  },
    'credit_wink':     { x: 101, y: 85,  w: 83,  h: 85,  rotated: true  },
    'credits':         { x: 3,   y: 447, w: 95,  h: 93,  rotated: false },
    'happy':           { x: 104, y: 3,   w: 93,  h: 78,  rotated: false },
    'heart':           { x: 3,   y: 68,  w: 94,  h: 82,  rotated: false },
    'market':          { x: 124, y: 261, w: 97,  h: 89,  rotated: false },
    'piggy_bank':      { x: 3,   y: 354, w: 96,  h: 89,  rotated: false },
    'star':            { x: 3,   y: 154, w: 88,  h: 85,  rotated: false },
    'star2':           { x: 118, y: 546, w: 102, h: 97,  rotated: false },
    'star_with_wing':  { x: 3,   y: 3,   w: 97,  h: 61,  rotated: false },
    'timer':           { x: 3,   y: 546, w: 111, h: 96,  rotated: false },
    'wallet':          { x: 103, y: 354, w: 107, h: 91,  rotated: false },
    '레이어 11':        { x: 3,   y: 647, w: 220, h: 175, rotated: false },
  },
}

export const MODE: SpriteSheet = {
  image: 'common/ui/mode.png',
  atlasW: 376,
  atlasH: 175,
  frames: {
    'morning':    { x: 3,   y: 3, w: 234, h: 169, rotated: false },
    'sleep_mode': { x: 241, y: 3, w: 132, h: 139, rotated: false },
  },
}

// ─── games/confetti ────────────────────────────────────────────────

export const CONGRATS: SpriteSheet = {
  image: 'games/confetti/congrats.png',
  atlasW: 99,
  atlasH: 270,
  frames: {
    'confetti (1)': { x: 62, y: 18,  w: 31, h: 48,  rotated: false },
    'confetti (2)': { x: 2,  y: 2,   w: 11, h: 14,  rotated: false },
    'confetti (3)': { x: 29, y: 2,   w: 15, h: 12,  rotated: false },
    'confetti (4)': { x: 2,  y: 18,  w: 17, h: 15,  rotated: false },
    'confetti (5)': { x: 21, y: 18,  w: 18, h: 16,  rotated: false },
    'confetti (6)': { x: 63, y: 2,   w: 16, h: 14,  rotated: false },
    'confetti (7)': { x: 15, y: 2,   w: 12, h: 10,  rotated: false },
    'confetti (8)': { x: 81, y: 2,   w: 16, h: 13,  rotated: false },
    'confetti (9)': { x: 46, y: 2,   w: 15, h: 13,  rotated: false },
    'fingercross':  { x: 2,  y: 123, w: 95, h: 145, rotated: false },
    'lights':       { x: 2,  y: 68,  w: 56, h: 53,  rotated: false },
    'twinkle':      { x: 41, y: 18,  w: 19, h: 20,  rotated: false },
  },
}

// ─── games/effects ─────────────────────────────────────────────────

export const BALLOONS: SpriteSheet = {
  image: 'games/effects/balloons.png',
  atlasW: 992,
  atlasH: 172,
  frames: {
    'balloon_!2': { x: 2,   y: 2, w: 174, h: 168, rotated: false },
    'balloon_2':  { x: 178, y: 2, w: 107, h: 141, rotated: false },
    'balloon_5':  { x: 287, y: 2, w: 120, h: 146, rotated: false },
    'balloon_6':  { x: 409, y: 2, w: 133, h: 162, rotated: false },
    'balloon_9':  { x: 544, y: 2, w: 163, h: 168, rotated: false },
    'blue':       { x: 709, y: 2, w: 69,  h: 142, rotated: false },
    'green':      { x: 780, y: 2, w: 68,  h: 142, rotated: false },
    'red':        { x: 850, y: 2, w: 69,  h: 142, rotated: false },
    'yellow':     { x: 921, y: 2, w: 69,  h: 142, rotated: false },
  },
}

// ─── games/farm ────────────────────────────────────────────────────

export const FARM_CAT: SpriteSheet = {
  image: 'games/farm/cat.png',
  atlasW: 438,
  atlasH: 365,
  frames: {
    'cat':       { x: 201, y: 192, w: 170, h: 191, rotated: true  },
    'cat_food':  { x: 3,   y: 258, w: 194, h: 98,  rotated: false },
    'cat_house': { x: 201, y: 3,   w: 185, h: 234, rotated: true  },
    'feed_cat':  { x: 3,   y: 3,   w: 194, h: 251, rotated: false },
  },
}

export const FARM_CHICKEN: SpriteSheet = {
  image: 'games/farm/chicken.png',
  atlasW: 226,
  atlasH: 623,
  frames: {
    'chicken':       { x: 3, y: 474, w: 146, h: 212, rotated: true  },
    'chicken_food':  { x: 3, y: 200, w: 220, h: 133, rotated: false },
    'chicken_house': { x: 3, y: 3,   w: 220, h: 193, rotated: false },
    'feed_chicken':  { x: 3, y: 337, w: 220, h: 133, rotated: false },
  },
}

export const FARM_COW: SpriteSheet = {
  image: 'games/farm/cow.png',
  atlasW: 241,
  atlasH: 833,
  frames: {
    'cow':       { x: 3, y: 620, w: 215, h: 210, rotated: false },
    'cow_food':  { x: 3, y: 3,   w: 227, h: 235, rotated: true  },
    'cow_house': { x: 3, y: 234, w: 225, h: 223, rotated: false },
    'feed_cow':  { x: 3, y: 461, w: 225, h: 155, rotated: false },
  },
}

export const FARM_DOG: SpriteSheet = {
  image: 'games/farm/dog.png',
  atlasW: 225,
  atlasH: 741,
  frames: {
    'dog':       { x: 1, y: 434, w: 169, h: 201, rotated: true  },
    'dog_food':  { x: 1, y: 605, w: 185, h: 135, rotated: false },
    'dog_house': { x: 1, y: 222, w: 220, h: 210, rotated: false },
    'feep_dog':  { x: 1, y: 1,   w: 223, h: 219, rotated: false },
  },
}

export const FARM_HORSE: SpriteSheet = {
  image: 'games/farm/horse.png',
  atlasW: 411,
  atlasH: 416,
  frames: {
    'feed_horse':  { x: 199, y: 1,   w: 211, h: 206, rotated: false },
    'horse':       { x: 1,   y: 1,   w: 196, h: 242, rotated: false },
    'horse_food':  { x: 1,   y: 245, w: 169, h: 185, rotated: true  },
    'horse_house': { x: 199, y: 209, w: 211, h: 206, rotated: false },
  },
}

export const FARM_PIGGY: SpriteSheet = {
  image: 'games/farm/piggy.png',
  atlasW: 875,
  atlasH: 159,
  frames: {
    'feed_piggy':  { x: 235, y: 1, w: 230, h: 146, rotated: false },
    'piggy':       { x: 699, y: 1, w: 175, h: 157, rotated: false },
    'piggy_food':  { x: 1,   y: 1, w: 232, h: 156, rotated: false },
    'piggy_house': { x: 467, y: 1, w: 230, h: 146, rotated: false },
  },
}

export const FARM_SHEEP: SpriteSheet = {
  image: 'games/farm/sheep.png',
  atlasW: 233,
  atlasH: 633,
  frames: {
    'feed_sheep':  { x: 3, y: 170, w: 227, h: 139, rotated: false },
    'sheep':       { x: 3, y: 450, w: 185, h: 180, rotated: false },
    'sheep_food':  { x: 3, y: 313, w: 227, h: 133, rotated: false },
    'sheep_house': { x: 3, y: 3,   w: 227, h: 163, rotated: false },
  },
}

// ─── items/piggy-bank ──────────────────────────────────────────────

/** 510×255 아틀라스. 레이어 284 는 구 JSON w=127 이 이미지 폭(510)을 넘겨 w=124 로 맞춤 */
export const PIGGY_BANK: SpriteSheet = {
  image: 'items/piggy-bank/piggy_bank.png',
  atlasW: 510,
  atlasH: 255,
  frames: {
    '레이어 279': { x: 382, y: 134, w: 124, h: 115, rotated: false },
    '레이어 280': { x: 131, y: 133, w: 126, h: 117, rotated: false },
    '레이어 281': { x: 3,   y: 136, w: 124, h: 116, rotated: false },
    '레이어 282': { x: 128, y: 3,   w: 126, h: 123, rotated: true  },
    '레이어 283': { x: 255, y: 3,   w: 127, h: 121, rotated: false },
    '레이어 284': { x: 386, y: 3,   w: 124, h: 121, rotated: true  },
    '레이어 285': { x: 3,   y: 3,   w: 129, h: 121, rotated: true  },
    '레이어 286': { x: 261, y: 128, w: 124, h: 117, rotated: true  },
  },
}

// ─── items/shop ────────────────────────────────────────────────────

export const SHOP_ANIMATIONS: SpriteSheet = {
  image: 'items/shop/animations.png',
  atlasW: 1387,
  atlasH: 1007,
  frames: {
    'allow':         { x: 519,  y: 384, w: 378, h: 331, rotated: false },
    'calculating':   { x: 901,  y: 390, w: 369, h: 308, rotated: false },
    'delivery':      { x: 519,  y: 3,   w: 480, h: 377, rotated: false },
    'level_up':      { x: 1003, y: 3,   w: 383, h: 381, rotated: true  },
    'message':       { x: 3,    y: 737, w: 391, h: 267, rotated: false },
    'paying':        { x: 519,  y: 719, w: 426, h: 278, rotated: false },
    'reward':        { x: 949,  y: 702, w: 285, h: 302, rotated: false },
    'sticker_board': { x: 3,    y: 3,   w: 512, h: 730, rotated: false },
    'tag':           { x: 398,  y: 737, w: 69,  h: 91,  rotated: false },
  },
}

export const MARKET_ITEMS: SpriteSheet = {
  image: 'items/shop/market_items.png',
  atlasW: 1545,
  atlasH: 253,
  frames: {
    'bear':             { x: 882,  y: 167, w: 77,  h: 98,  rotated: true  },
    'blocks':           { x: 1082, y: 161, w: 95,  h: 89,  rotated: false },
    'bluberry_juice':   { x: 876,  y: 3,   w: 66,  h: 160, rotated: false },
    'candy':            { x: 1428, y: 123, w: 119, h: 106, rotated: true  },
    'chew':             { x: 567,  y: 3,   w: 125, h: 167, rotated: false },
    'chew2':            { x: 696,  y: 3,   w: 114, h: 167, rotated: false },
    'chips':            { x: 437,  y: 3,   w: 126, h: 167, rotated: false },
    'choco_milk':       { x: 946,  y: 3,   w: 89,  h: 155, rotated: false },
    'chocolate (2)':    { x: 1328, y: 147, w: 99,  h: 96,  rotated: true  },
    'chocolate':        { x: 1244, y: 3,   w: 112, h: 140, rotated: false },
    'coockie':          { x: 1428, y: 3,   w: 116, h: 114, rotated: true  },
    'drink':            { x: 360,  y: 3,   w: 73,  h: 205, rotated: false },
    'flower':           { x: 437,  y: 174, w: 74,  h: 112, rotated: true  },
    'gummy':            { x: 814,  y: 3,   w: 58,  h: 161, rotated: false },
    'icecream':         { x: 1181, y: 157, w: 91,  h: 143, rotated: true  },
    'luckybox':         { x: 984,  y: 162, w: 86,  h: 94,  rotated: true  },
    'mango_juice':      { x: 553,  y: 174, w: 68,  h: 161, rotated: true  },
    'pudding':          { x: 1132, y: 3,   w: 150, h: 108, rotated: true  },
    'strawberry_juice': { x: 718,  y: 174, w: 67,  h: 160, rotated: true  },
    'strawberry_milk':  { x: 1039, y: 3,   w: 89,  h: 154, rotated: false },
    '레이어 9':          { x: 172,  y: 3,   w: 221, h: 184, rotated: true  },
    '레이어 10':         { x: 3,    y: 3,   w: 165, h: 226, rotated: false },
  },
}

// ─── layouts/banners ───────────────────────────────────────────────

export const BANNERS: SpriteSheet = {
  image: 'layouts/banners/banners.png',
  atlasW: 437,
  atlasH: 1172,
  frames: {
    'alarm':          { x: 3,   y: 509, w: 431, h: 328, rotated: false },
    'board':          { x: 3,   y: 841, w: 413, h: 328, rotated: false },
    'notice_speaker': { x: 3,   y: 217, w: 384, h: 288, rotated: false },
    'special':        { x: 3,   y: 3,   w: 100, h: 101, rotated: true  },
    'special_mark':   { x: 216, y: 3,   w: 210, h: 214, rotated: true  },
    '레이어 270':      { x: 108, y: 3,   w: 104, h: 102, rotated: false },
  },
}

// ─── missions ──────────────────────────────────────────────────────

export const ROUTINES_01: SpriteSheet = {
  image: 'missions/routines_01.png',
  atlasW: 509,
  atlasH: 1637,
  frames: {
    'alarm':          { x: 384, y: 576,  w: 122, h: 123, rotated: false },
    'bath':           { x: 146, y: 687,  w: 138, h: 110, rotated: false },
    'book':           { x: 273, y: 801,  w: 132, h: 106, rotated: true  },
    'breakfase':      { x: 274, y: 1216, w: 131, h: 131, rotated: false },
    'brush_teeth':    { x: 288, y: 618,  w: 76,  h: 101, rotated: false },
    'change':         { x: 384, y: 445,  w: 127, h: 122, rotated: true  },
    'chicken':        { x: 142, y: 1359, w: 131, h: 131, rotated: false },
    'dinner':         { x: 383, y: 841,  w: 117, h: 83,  rotated: false },
    'dringking':      { x: 409, y: 1172, w: 81,  h: 106, rotated: false },
    'eat_well':       { x: 277, y: 1486, w: 126, h: 114, rotated: false },
    'homework':       { x: 383, y: 703,  w: 134, h: 123, rotated: true  },
    'loundry':        { x: 409, y: 1282, w: 101, h: 86,  rotated: true  },
    'organize_cloth': { x: 128, y: 801,  w: 131, h: 141, rotated: true  },
    'organize_toys':  { x: 148, y: 1494, w: 127, h: 124, rotated: true  },
    'pajama':         { x: 268, y: 1078, w: 132, h: 134, rotated: false },
    'play_inside':    { x: 138, y: 1072, w: 126, h: 141, rotated: false },
    'play_outside':   { x: 3,   y: 3,    w: 242, h: 188, rotated: false },
    'play_sand':      { x: 277, y: 485,  w: 129, h: 103, rotated: true  },
    'reading_book':   { x: 211, y: 195,  w: 96,  h: 144, rotated: false },
    'shower':         { x: 3,   y: 390,  w: 131, h: 177, rotated: false },
    'wash_hand':      { x: 406, y: 1054, w: 99,  h: 114, rotated: false },
    'water':          { x: 431, y: 149,  w: 75,  h: 115, rotated: false },
    'yoga':           { x: 146, y: 539,  w: 144, h: 127, rotated: true  },
    '레이어 3':        { x: 3,   y: 1520, w: 114, h: 141, rotated: true  },
    '레이어 4':        { x: 311, y: 166,  w: 116, h: 143, rotated: false },
    '레이어 5':        { x: 3,   y: 1225, w: 144, h: 135, rotated: true  },
    '레이어 6':        { x: 268, y: 937,  w: 137, h: 134, rotated: true  },
    '레이어 7':        { x: 142, y: 1217, w: 138, h: 128, rotated: true  },
    '레이어 8':        { x: 123, y: 936,  w: 141, h: 132, rotated: false },
    '레이어 12':       { x: 3,   y: 195,  w: 204, h: 191, rotated: false },
    '레이어 13':       { x: 3,   y: 571,  w: 139, h: 162, rotated: false },
    '레이어 14':       { x: 277, y: 1351, w: 125, h: 131, rotated: false },
    '레이어 15':       { x: 3,   y: 905,  w: 166, h: 116, rotated: true  },
    '레이어 16':       { x: 138, y: 390,  w: 113, h: 145, rotated: false },
    '레이어 17':       { x: 413, y: 3,    w: 89,  h: 142, rotated: false },
    '레이어 18':       { x: 255, y: 343,  w: 138, h: 125, rotated: true  },
    '레이어 19':       { x: 384, y: 313,  w: 128, h: 122, rotated: true  },
    '레이어 20':       { x: 406, y: 928,  w: 99,  h: 122, rotated: false },
    '레이어 21':       { x: 3,   y: 1373, w: 134, h: 143, rotated: false },
    '레이어 100':      { x: 3,   y: 1075, w: 131, h: 146, rotated: false },
    '레이어 102':      { x: 3,   y: 737,  w: 121, h: 164, rotated: false },
    '레이어 103':      { x: 249, y: 3,    w: 160, h: 159, rotated: false },
  },
}

// ─── Union types per category ───────────────────────────────────────

export type BearFrameName      = keyof typeof BEARS.frames
export type BunnyFrameName     = keyof typeof BUNNY.frames
export type ChicksFrameName    = keyof typeof CHICKS.frames
export type FoxFrameName       = keyof typeof FOX.frames
export type HamsterFrameName   = keyof typeof HAMSTER.frames
export type OtterFrameName     = keyof typeof OTTER.frames
export type BunnyRunFrameName  = keyof typeof BUNNY_RUN.frames
export type IconFrameName      = keyof typeof ICONS.frames
export type ModeFrameName      = keyof typeof MODE.frames
export type CongratsFrameName  = keyof typeof CONGRATS.frames
export type BalloonFrameName   = keyof typeof BALLOONS.frames
export type FarmCatFrameName   = keyof typeof FARM_CAT.frames
export type FarmChickenFrameName = keyof typeof FARM_CHICKEN.frames
export type FarmCowFrameName   = keyof typeof FARM_COW.frames
export type FarmDogFrameName   = keyof typeof FARM_DOG.frames
export type FarmHorseFrameName = keyof typeof FARM_HORSE.frames
export type FarmPiggyFrameName = keyof typeof FARM_PIGGY.frames
export type FarmSheepFrameName = keyof typeof FARM_SHEEP.frames
export type PiggyBankFrameName = keyof typeof PIGGY_BANK.frames
export type ShopAnimFrameName  = keyof typeof SHOP_ANIMATIONS.frames
export type MarketItemFrameName = keyof typeof MARKET_ITEMS.frames
export type BannerFrameName    = keyof typeof BANNERS.frames
export type RoutineFrameName   = keyof typeof ROUTINES_01.frames
