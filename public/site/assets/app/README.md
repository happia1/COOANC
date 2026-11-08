# Homepage image sources

These are local copies of existing COOANC assets; no app screenshots were fabricated.

- `mission-detail.jpg`: cropped `../child-home.webp` (800×640, offset 14,1120).
- `progress-detail.jpg`: cropped `../parent-home.webp` (760×320, offset 34,800).
- `routine-detail.jpg`: cropped `../parent-routine.webp` (800×640, offset 14,950).
- `market-detail.jpg`: cropped `../parent-market.webp` (800×700, offset 14,980); parent goods management, not the child's shop.
- `bunny-front.png`: front frame of `public/assets/img/characters/base/bunny.png`, using `bunny.json` (243×537, offset 1,546).
- `otter.png`, `bear.png`, `hamster.png`, `chick.png`: respective `_profile.png` in the same app character directory.
- `map.png`: `public/assets/img/common/ui/map.png`.
- `stringcheese.png`: `public/assets/img/items/shop/items/건강간식/stringcheese.png`.
- `share-cover.jpg`: cropped `../hero-2.png` (1367×718, offset 0,17).

Screenshots are pre-existing examples, not newly captured production state. Character, plant, piggy bank and shop illustrations are labelled as app artwork on the page. Full captures remain available through ordinary image links.

- `gargle.png`, `comb-hair.png`: resized copies (max 384px) of `public/assets/img/missions/routine/a.m/gargle.png` and `comb_hair.png` for the interactive homepage demo. The demo follows `ChildMissionCard`'s tap-to-remove interaction and uses sample rewards, with no app API or account persistence.

The phone preview displays the top of the original `child-home.webp` via CSS clipping and joins it to the interactive mission area. The parent preview uses the full original capture.

- `wake.png`, `breakfast.png`, `wash-face.png`: resized copies (max 384px) of the app's `missions/routine/a.m/morning.png`, `breakfase.png`, and `wash_face.png`.
- `coin.png`: resized app `public/assets/img/common/ui/크레딧.png`.
- `heart.png`: resized existing site `icons/rewards/heart (1).png`.
- `tablet-room.jpg`: resized JPEG of `public/assets/img/layouts/backgrounds/tablet_kidsroom_background_portrait.png`.

The service tour's tablet is an illustrative HTML composition of original app artwork, labelled as an example, not a captured tablet screen. Parent tour screens are the original full captures. Unlock badges follow `src/lib/parentChildLevelUnlocks.ts`: missions/market/plant 0, stickers 1, piggy bank 5, content chest 8, mini-games 10. Unreleased features have no promised unlock level.

- `tablet-room-current.jpg`: resized current child-home background `public/assets/img/layouts/backgrounds/tablet_kidsroom_background_portrait2.png`, as configured in `src/constants/assets.ts`. Replaces the older tour room.

- `video-ticket.png`, `game-ticket.png`: original app `items/shop/items/콘텐츠/contents.png` and `minigame.png`, resized for the child feature preview. The 20-slot board uses the existing site sticker-board illustration.

Core feature artwork: `apple-stage-{0,1,4,7}.png` all come from the same `plant/apple` folder. `{tree}-grown.png` uses each tree’s `7.png` (blueberry maps to the app folder `bluberry`). `piggy-stage-{1,5,10,14}.png` are original piggybank frames; ranges follow `src/lib/piggyBankHomeStage.ts` (14 intervals over 1000 credits). `pomodoro.png` and `music.png` use app common/ui artwork. Video examples follow the initial channel list in migration 096; only claw machine is implemented in ChildContentZonePopup, other learning games are explicitly proposals.

Guide habit tips: `meal-finished.png`, `clear-dishes.png`, and `say-hello.png` are unchanged copies of app mission artwork `routine/special/clean_up_all.png`, `put_away_dishes.png`, and `say_hello.png`.

`set-cutlery.png`: unchanged app mission `routine/special/put_cutrary.png`. Guide setup panels are simplified HTML illustrations based on signup, onboarding, and RoutineOnboarding components, not screenshots.
