const STORAGE_KEY = 'quiz-brawl-session';

export interface RememberedSession {
  playerId: string;
  resumeToken: string;
}

// 내 플레이어 id와 복귀 토큰을 탭에 기억해 두어, 새로고침하거나 잠깐 끊겨도 같은 캐릭터·점수로 돌아올 수 있게 한다.
// sessionStorage는 탭마다 따로라서 탭을 여러 개 열어 여러 명으로 테스트할 수 있다.
export function rememberSession(session: RememberedSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // 저장이 막힌 브라우저(시크릿 창 등)에서는 재접속 복귀만 못 할 뿐 게임은 된다.
  }
}

export function recallSession(): RememberedSession | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return null;
    }
    const parsed = JSON.parse(stored) as Partial<RememberedSession>;
    if (typeof parsed.playerId !== 'string' || typeof parsed.resumeToken !== 'string') {
      return null;
    }
    return { playerId: parsed.playerId, resumeToken: parsed.resumeToken };
  } catch {
    return null;
  }
}

export function forgetSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}
