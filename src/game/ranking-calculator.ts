import type { PlayerEntity, RankingEntry } from './game-types';

// 점수 내림차순으로 정렬하고, 동점이면 같은 순위를 준다. (예: 1, 2, 2, 4)
export function rankPlayers(players: PlayerEntity[]): RankingEntry[] {
  const sorted = [...players].sort((first, second) => second.score - first.score || first.colorIndex - second.colorIndex);
  const rankings: RankingEntry[] = [];
  sorted.forEach((player, index) => {
    const previous = rankings[index - 1];
    const rank = previous && previous.score === player.score ? previous.rank : index + 1;
    rankings.push({
      playerId: player.id,
      nickname: player.nickname,
      colorIndex: player.colorIndex,
      score: player.score,
      rank,
    });
  });
  return rankings;
}
