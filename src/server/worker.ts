import type { ServerEnv } from './server-env';

import { isSameOrigin } from './origin-guard';

export { GameRoom } from './game-room';

// 방(Durable Object)은 처음 만들어질 때 위치가 정해지므로 아시아 쪽에 만들라고 힌트를 준다.
// 이름을 바꾸면 새 위치에 새 방이 만들어진다(게임 상태는 메모리에만 있어 잃을 것이 없다).
const ROOM_NAME = 'main-apac';
const ROOM_LOCATION_HINT: DurableObjectLocationHint = 'apac';

// 정적 파일(public/)은 Workers Assets가 먼저 응답하고, 나머지 요청만 여기로 온다.
// Workers 런타임이 default export를 진입점으로 요구한다.
export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/ws') {
      return new Response('Not Found', { status: 404 });
    }
    if (!isSameOrigin(request, url)) {
      return new Response('Forbidden', { status: 403 });
    }
    return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(ROOM_NAME), { locationHint: ROOM_LOCATION_HINT }).fetch(request);
  },
} satisfies ExportedHandler<ServerEnv>;
