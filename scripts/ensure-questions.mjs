// 실제 문제 파일(src/server/questions.json)은 git에 올리지 않는다. 없으면 예시 문제를 복사해 빌드·테스트가 되게 한다.
import { copyFileSync, existsSync } from 'node:fs';

const QUESTIONS_PATH = 'src/server/questions.json';
const EXAMPLE_PATH = 'src/server/questions.example.json';

if (!existsSync(QUESTIONS_PATH)) {
  copyFileSync(EXAMPLE_PATH, QUESTIONS_PATH);
  console.log(`${QUESTIONS_PATH} 가 없어 ${EXAMPLE_PATH} 를 복사했습니다. 실제 문제로 바꿔 쓰세요.`);
}
