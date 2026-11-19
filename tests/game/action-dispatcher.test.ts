import { describe, expect, it } from 'vitest';

import { processPlayerActions } from '../../src/game/action-dispatcher';
import { pickUpItem } from '../../src/game/item-system';
import { addTestItem, addTestPlayer, ARENA_CENTER, CONFIG, createTestWorld, offsetPosition } from './test-helpers';

function pressPunch(world: ReturnType<typeof createTestWorld>, playerId: string) {
  const player = world.players.get(playerId);
  if (!player) {
    throw new Error('테스트 플레이어가 없습니다.');
  }
  player.input.punchCount += 1;
  processPlayerActions(player, world, CONFIG);
  return player;
}

describe('Z 버튼 우선순위', () => {
  it('아이템을 들고 있으면 붙어 있는 상대가 있어도 아이템을 던진다', () => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'a', ARENA_CENTER, { isRightPressed: true });
    addTestPlayer(world, 'b', offsetPosition(ARENA_CENTER, 40));
    pickUpItem(player, addTestItem(world, 'item', ARENA_CENTER));
    expect(pressPunch(world, 'a').state).toBe('tossing');
  });

  it('상대와 붙어서 상대 방향키를 누르고 있으면 아이템 위여도 상대를 잡는다', () => {
    const world = createTestWorld();
    addTestPlayer(world, 'a', ARENA_CENTER, { isRightPressed: true });
    addTestPlayer(world, 'b', offsetPosition(ARENA_CENTER, 40));
    addTestItem(world, 'item', ARENA_CENTER);
    expect(pressPunch(world, 'a').state).toBe('lifting');
  });

  it('아이템 위에 있으면 줍는다', () => {
    const world = createTestWorld();
    addTestPlayer(world, 'a', ARENA_CENTER);
    addTestItem(world, 'item', ARENA_CENTER);
    expect(pressPunch(world, 'a').heldItemId).toBe('item');
  });

  it('그 외에는 주먹을 휘두른다', () => {
    const world = createTestWorld();
    addTestPlayer(world, 'a', ARENA_CENTER);
    expect(pressPunch(world, 'a').state).toBe('punching');
  });
});

describe('processPlayerActions', () => {
  it('막기 중에는 Z를 눌러도 아무것도 하지 않는다', () => {
    const world = createTestWorld();
    addTestPlayer(world, 'a', ARENA_CENTER, { isBlockPressed: true });
    const player = pressPunch(world, 'a');
    expect(player.isBlocking).toBe(true);
    expect(player.state).toBe('free');
  });

  it('경직 중에는 막기와 공격이 되지 않는다', () => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'a', ARENA_CENTER, { isBlockPressed: true });
    player.state = 'stunned';
    player.input.kickCount += 1;
    processPlayerActions(player, world, CONFIG);
    expect(player.isBlocking).toBe(false);
    expect(player.state).toBe('stunned');
    expect(player.handledKickCount).toBe(1);
  });

  it('X를 누르면 발차기를 한다', () => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'a', ARENA_CENTER);
    player.input.kickCount += 1;
    processPlayerActions(player, world, CONFIG);
    expect(player.state).toBe('kicking');
  });

  it('누름 횟수가 그대로면 같은 입력을 다시 처리하지 않는다', () => {
    const world = createTestWorld();
    const player = addTestPlayer(world, 'a', ARENA_CENTER);
    processPlayerActions(player, world, CONFIG);
    expect(player.state).toBe('free');
  });
});
