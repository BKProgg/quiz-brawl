import type { GameConfig } from './game-config';
import type { PlayerEntity, WorldState } from './game-types';

import { startStrike } from './combat-resolver';
import { findGrabTarget, handleLiftingPunchPress, startGrab } from './grab-throw';
import { findPickupItem, pickUpItem, tossHeldItem } from './item-system';

// 입력의 버튼 누름 횟수가 바뀌었으면 그 버튼을 한 번 누른 것으로 처리한다.
export function processPlayerActions(player: PlayerEntity, world: WorldState, config: GameConfig): void {
  player.isBlocking = player.input.isBlockPressed && player.state === 'free';
  if (player.input.punchCount !== player.handledPunchCount) {
    player.handledPunchCount = player.input.punchCount;
    handlePunchPress(player, world, config);
  }
  if (player.input.kickCount !== player.handledKickCount) {
    player.handledKickCount = player.input.kickCount;
    handleKickPress(player, config);
  }
}

function canStartAction(player: PlayerEntity): boolean {
  return player.state === 'free' && !player.isBlocking;
}

// Z 버튼 우선순위: 들고 있는 상대 던지기 > 아이템 던지기 > 상대 잡기 > 아이템 줍기 > 주먹
export function handlePunchPress(player: PlayerEntity, world: WorldState, config: GameConfig): void {
  if (player.state === 'lifting') {
    handleLiftingPunchPress(player, world, config);
    return;
  }
  if (!canStartAction(player)) {
    return;
  }
  if (player.heldItemId !== null) {
    tossHeldItem(player, world, config);
    return;
  }
  const grabTarget = findGrabTarget(player, world, config);
  if (grabTarget) {
    startGrab(player, grabTarget, world, config);
    return;
  }
  const item = findPickupItem(player, world, config);
  if (item) {
    pickUpItem(player, item);
    return;
  }
  startStrike(player, 'punch', config);
}

export function handleKickPress(player: PlayerEntity, config: GameConfig): void {
  if (canStartAction(player)) {
    startStrike(player, 'kick', config);
  }
}
