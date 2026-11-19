import type { GameConfig } from './game-config';
import type { AnswerZone, PlayerEntity, QuizQuestion, RandomSource, Vector } from './game-types';

import { getChoices } from './quiz-questions';

interface ZoneRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 선택지 구역이 경기장을 거의 꽉 채우게 나눈다. (OX: 좌우 2칸, 4지선다: 2×2)
// 구역 사이에는 어느 쪽에도 속하지 않는 좁은 통로(zone.gap)만 남긴다. 위아래 가장자리까지 구역에 포함된다.
// 어느 칸에 몇 번 보기가 오는지는 문제마다 섞어, 위치를 외워 미리 가 있을 수 없게 한다.
export function placeAnswerZones(question: QuizQuestion, config: GameConfig, random: RandomSource): AnswerZone[] {
  const choices = getChoices(question);
  const cells = shuffleCells(createGridCells(choices.length, config), random);
  return choices.map((choice, choiceIndex) => ({
    ...(cells[choiceIndex] as ZoneRectangle),
    choiceIndex,
    label: question.type === 'OX' ? choice : String(choiceIndex + 1),
    text: question.type === 'OX' ? '' : choice,
  }));
}

function createGridCells(count: number, config: GameConfig): ZoneRectangle[] {
  const { left, right, top, bottom } = config.arena;
  const { gap } = config.zone;
  const columns = count <= 1 ? 1 : 2;
  const rows = Math.ceil(count / columns);
  const width = (right - left - gap * (columns - 1)) / columns;
  const height = (bottom - top - gap * (rows - 1)) / rows;
  return Array.from({ length: count }, (_, index) => ({
    x: left + (index % columns) * (width + gap),
    y: top + Math.floor(index / columns) * (height + gap),
    width,
    height,
  }));
}

function shuffleCells(cells: ZoneRectangle[], random: RandomSource): ZoneRectangle[] {
  const shuffled = [...cells];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex] as ZoneRectangle, shuffled[index] as ZoneRectangle];
  }
  return shuffled;
}

export function isPositionInsideZone(position: Vector, zone: ZoneRectangle): boolean {
  return position.x >= zone.x && position.x <= zone.x + zone.width && position.y >= zone.y && position.y <= zone.y + zone.height;
}

// 판정 순간 캐릭터 중심이 정답 구역 위에 있으면 상태와 상관없이 득점한다. 날아가는 중이어도, 쓰러져 있어도, 들려 있어도 위치로만 판단한다.
export function findScorerIds(players: PlayerEntity[], zone: AnswerZone): string[] {
  return players.filter((player) => isPositionInsideZone(player.position, zone)).map((player) => player.id);
}
