import type { GameRoom } from './game-room';

export interface ServerEnv {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
}
