# 이미지 생성 프롬프트 (GPT Image / Nano Banana)

코드로 그린 그림 대신 이미지 모델로 에셋을 만들 때 쓰는 프롬프트 모음입니다.
프롬프트는 영어가 결과가 안정적이라 영어로 작성했고, 설명은 한국어로 달았습니다.

## 0. 먼저 알아둘 것

1. **스타일 일관성이 가장 큰 문제입니다.** 에셋을 하나씩 따로 만들면 그림체가 조금씩 달라집니다.
   - 모든 프롬프트 앞에 아래 `공통 스타일` 블록을 그대로 붙입니다.
   - **기준 캐릭터를 먼저 만들고**, 이후 동작·소품은 그 이미지를 **참고 이미지로 첨부**해서 만듭니다. 두 모델 모두 이미지 첨부를 지원합니다.
2. **색상 10종은 이미지로 10번 만들지 않습니다.** 몸통이 흰색인 캐릭터 1개만 만들고, 게임 코드에서 색을 입힙니다.
   그래야 10명이 완전히 같은 그림체가 됩니다.
3. **체형 5종**도 기본 체형 1개를 코드에서 가로·세로 비율로 늘이고 줄이는 방식을 우선 시도하고,
   어색하면 체형별로 따로 생성합니다.
4. **투명 배경**
   - GPT Image: API의 `background: "transparent"` 옵션을 쓰거나, ChatGPT에서는 "transparent background PNG"를 요청합니다.
   - Nano Banana: 투명 배경이 안정적이지 않습니다. **단색 배경(#00FF00 초록)**으로 생성한 뒤 배경 제거 도구로 지웁니다.
5. **기존 캐릭터 이름(어몽어스, 미니언즈 등)은 프롬프트에 쓰지 않습니다.** 닮은 결과가 나와 저작권 문제가 생길 수 있어서, 원하는 느낌을 말로 풀어 썼습니다.
6. **글자는 이미지에 넣지 않습니다.** "퍽!" 같은 글자와 숫자는 게임 코드가 그립니다. 이미지 모델은 한글을 자주 틀립니다.

## 공통 스타일 (모든 프롬프트 앞에 붙임)

```
Style: cute minimal 2D cartoon game asset, flat colors with soft cel shading, thick clean dark navy outline (#1f2430),
rounded chunky shapes, friendly and playful, casual party game look, consistent lighting from top-left,
3/4 top-down camera angle, no text, no letters, no watermark, no background scenery.
```

## 1. 캐릭터

### 1-1. 기준 캐릭터 (가장 먼저 생성)

```
[공통 스타일]
A single game character standing still, facing right, full body, centered.
Design: a small round jellybean-shaped body that is both head and torso (no separate neck),
pure white body color (#FFFFFF) so it can be recolored in code, a slightly darker band at the bottom like shorts,
two large round cartoon eyes with black pupils and a white sparkle, small pink blush marks, tiny happy smile,
thin stick-figure arms and legs in light gray with small round hands and oval shoes.
Proportions: body about 70% of total height, legs short. No accessories, no hat, no goggles, no visor.
Transparent background (or solid #00FF00 background), 1024x1024.
```

### 1-2. 동작 시트 (기준 캐릭터 이미지를 첨부해서 생성)

```
[공통 스타일]
Using the attached character exactly as the reference (same body shape, eyes, outline, white body color),
create a sprite sheet in a 5 x 2 grid with equal cells and generous spacing, every pose facing right:
Row 1: idle standing / walking mid-stride / punching with front arm fully extended /
       side kick with front leg extended horizontally / blocking with both arms crossed in front of the face, eyes squeezed shut
Row 2: holding an object above the head with both arms / dizzy after being hit (X eyes, tilted, little stars above head) /
       flying through the air after being thrown (spinning, arms and legs flailing, shocked open mouth) /
       knocked down lying flat on the floor (X eyes) / victory cheer with both arms raised and big open smile
Same size and scale in every cell, feet aligned to the bottom of each cell, transparent (or solid #00FF00) background.
```

- 한 번에 10개 동작이 잘 안 나오면 **한 장에 동작 1개씩** 생성하는 것이 더 안정적입니다.
- 걷기 애니메이션이 필요하면 "walking cycle, 4 frames in a row" 시트를 따로 요청합니다.

### 1-3. 체형 변형 (필요할 때만)

```
[공통 스타일]
Using the attached character as the reference, create 5 body type variations side by side, all facing right, idle pose:
1) standard, 2) chubby and wide with short limbs, 3) skinny and narrow with long limbs,
4) slightly wide with long limbs, 5) small and narrow with short limbs.
Keep the same face, outline, white body color and style. Transparent (or solid #00FF00) background.
```

## 2. 경기장 배경

```
[공통 스타일 — 단, "no background scenery" 문장은 빼고 사용]
Top-down view of a cozy office-themed game arena floor, 16:9, 1600x900.
Soft light-gray carpet tiles in a subtle checker pattern, low contrast and calm so characters stand out,
a thick dark rounded border wall around the edges, a few decorative desks, plants and water cooler only along the outer edges.
The center area must be completely empty and evenly lit. No people, no text.
```

- 정답 구역(색깔 사각형)은 문제마다 위치가 바뀌므로 배경에 그리지 않고 코드로 그립니다.

## 3. 바닥 소품 (잡동사니 6종)

각각 따로 생성하거나, 한 장에 3 x 2로 생성합니다.

```
[공통 스타일]
A set of 6 office junk props for a party game, 3 x 2 grid, each prop centered in its cell, same scale and outline thickness:
1) white coffee mug with a small blue code symbol, 2) dark computer keyboard,
3) orange office chair with wheels, 4) messy stack of paper documents,
5) small potted green plant in a terracotta pot, 6) yellow rubber duck.
Transparent (or solid #00FF00) background, no text.
```

## 4. 최종 순위 연출

### 4-1. 무대 배경

```
[공통 스타일 — 단, "no background scenery" 문장은 빼고 사용]
A dramatic award ceremony stage background, 16:9, 1600x900, deep purple and navy gradient,
two crossing spotlight beams from the top corners, subtle sparkles, a dark glossy stage floor at the bottom.
Leave the center and the right third empty for a podium and a ranking panel. No text, no people.
```

### 4-2. 시상대, 왕관, 트로피

```
[공통 스타일]
Game UI props on a transparent (or solid #00FF00) background, side by side, same style:
1) a three-step winner podium (gold center tallest, silver left, bronze right), front faces left blank with no numbers,
2) a cute shiny gold crown with three red and blue gems, 3) a small gold trophy cup with handles.
```

## 5. 효과 (선택)

```
[공통 스타일]
Cartoon comic effect sprites, side by side, transparent (or solid #00FF00) background, no text:
1) yellow and orange impact starburst, 2) small gray dust puff cloud, 3) blue semi-transparent shield arc,
4) three small yellow dizzy stars, 5) colorful confetti pieces.
```

## 생성한 이미지 가공 (`npm run assets`)

생성 결과(초록 배경 그대로)를 `assets-source/`에 아래 이름으로 넣고 `npm run assets`를 실행하면,
배경 제거, 동작별 자르기, 워터마크 정리를 거쳐 `public/assets/`와 `manifest.json`이 만들어집니다.

| 원본 파일 | 내용 |
|---|---|
| `{스타일}-actions.png` | 동작 시트 5 x 2 (기본, 걷기, 주먹, 발차기, 막기 / 들기, 맞음, 던져짐, 다운, 우승 순서) |
| `{스타일}-base.png` | 기준 캐릭터 1장 |
| `office-props.png` | 소품 3 x 2 |
| `arena-office.png` | 경기장 배경 |

- 스타일 이름은 `scripts/process-assets.mjs`의 `CHARACTER_STYLES`에 추가합니다. (현재 `cute`, `visor`)
- 동작 시트에서 캐릭터끼리 맞닿아 있으면 개수 불일치 오류가 납니다. 간격을 넓혀 다시 생성하세요.

## 파일 저장 규칙 (게임 코드가 읽을 경로)

| 파일 | 내용 |
|---|---|
| `public/assets/characters/base-idle.png` 등 | 기준 캐릭터, 동작별 1장씩 (`base-walk`, `base-punch`, `base-kick`, `base-block`, `base-hold`, `base-stunned`, `base-airborne`, `base-down`, `base-cheer`) |
| `public/assets/arena/floor.png` | 경기장 배경 |
| `public/assets/items/item-0.png` ~ `item-5.png` | 소품 6종 (머그컵, 키보드, 의자, 서류, 화분, 오리 순서) |
| `public/assets/ceremony/stage.png`, `podium.png`, `crown.png`, `trophy.png` | 최종 순위 연출 |

- 캐릭터는 1024x1024로 생성한 뒤 256x256으로 줄여 저장하면 충분합니다.
- 생성 결과를 이 경로에 넣으면, 게임 코드는 이미지가 있으면 이미지를 쓰고 없으면 지금처럼 코드로 그리도록 만들 예정입니다.
