import type { InputMessage, NewGameMessage, PingMessage, ServerMessage, StartMessage } from '../game/protocol-types';
import type { ClientSession } from './client-session';
import type { MatchController } from './match-controller';

import { toPlayerInput } from './game-room-helpers';

export type RoomCommandMessage = InputMessage | StartMessage | NewGameMessage | PingMessage;

// 입장한 뒤의 명령 처리가 방(GameRoom)에서 필요로 하는 것들
export interface CommandPort {
  getController(): MatchController;
  send(session: ClientSession, message: ServerMessage): void;
  broadcast(message: ServerMessage): void;
  resetRoom(): void;
}

// 입장한 연결의 명령. 게임 시작·새 게임(초기화)은 관리자 연결만, 입력은 플레이어 연결만 받는다.
export function handleRoomCommand(port: CommandPort, session: ClientSession, message: RoomCommandMessage): void {
  switch (message.type) {
    case 'input':
      if (session.playerId !== null) {
        port.getController().setInput(session.playerId, toPlayerInput(message));
      }
      break;
    case 'start':
      if (session.isAdmin) {
        port.getController().startMatch().forEach((outgoing) => port.broadcast(outgoing));
      }
      break;
    case 'newGame':
      if (session.isAdmin) {
        port.resetRoom();
      }
      break;
    case 'ping':
      port.send(session, { type: 'pong', clientTime: message.clientTime });
      break;
    default:
      break;
  }
}
