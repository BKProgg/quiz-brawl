// 시나리오 단계들이 함께 쓰는 도우미: 검사 기록, 화면 상태 읽기, 입장, 프레임·메모리 측정.
import { join as joinPath } from 'node:path';

import { sleep } from './browser-page.mjs';

export const tileSelector = (colorIndex) => `.character-tile:nth-child(${colorIndex + 1})`;

export function createRecorder(startedAt) {
  const checks = [];
  const log = (text) => console.log(`${((Date.now() - startedAt) / 1000).toFixed(1).padStart(6)}s ${text}`);
  const check = (name, isPassed, detail = '') => {
    checks.push({ name, isPassed, detail });
    log(`${isPassed ? '통과' : '실패'}  ${name}${detail ? ` — ${detail}` : ''}`);
  };
  return { checks, log, check };
}

export function readPickerState(page) {
  return page.evaluate(`(()=>({isPickerHidden:document.querySelector('#character-picker').hidden,` +
    `message:document.querySelector('#picker-message').textContent,` +
    `enabledTiles:[...document.querySelectorAll('.character-tile')].filter(b=>!b.disabled).length}))()`);
}

export async function waitForPage(page, expression, timeoutSeconds = 8) {
  for (let attempt = 0; attempt < timeoutSeconds * 10; attempt += 1) {
    if (await page.evaluate(expression)) {
      return true;
    }
    await sleep(100);
  }
  return false;
}

// 실제 사용자처럼 닉네임 칸에 글자를 넣고 캐릭터 칸을 마우스로 누른다.
export async function typeNickname(page, nickname) {
  await waitForPage(page, `document.querySelectorAll('.character-tile:not([disabled])').length>0`);
  await page.evaluate(`(()=>{const i=document.querySelector('#nickname-input');i.value='';i.focus();})()`);
  await page.send('Input.insertText', { text: nickname });
}

export async function joinGame(page, nickname, colorIndex) {
  await typeNickname(page, nickname);
  return page.click(tileSelector(colorIndex));
}

export const takeScreenshot = (outputDirectory, page, name) => page.screenshot(joinPath(outputDirectory, `${name}.jpg`));

// 창마다 초당 화면 갱신 횟수를 잰다.
export async function sampleFrames(pages, seconds, frameSamples) {
  const read = () => Promise.all(pages.map((page) => page.evaluate('window.__frameCount')));
  const before = await read();
  await sleep(seconds * 1000);
  const after = await read();
  pages.forEach((page, index) => {
    if (typeof before[index] === 'number' && typeof after[index] === 'number') {
      frameSamples.set(page.label, [...(frameSamples.get(page.label) ?? []), Math.round((after[index] - before[index]) / seconds)]);
    }
  });
}

// 프레임당 작업 시간(ms). 화면을 오래 띄워 두어도 늘지 않아야 한다.
export async function measureFrameCost(page, seconds) {
  const read = async () => {
    const { metrics } = await page.send('Performance.getMetrics');
    return { task: metrics.find((metric) => metric.name === 'TaskDuration').value, frames: await page.evaluate('window.__frameCount') };
  };
  const before = await read();
  await sleep(seconds * 1000);
  const after = await read();
  return ((after.task - before.task) * 1000) / Math.max(1, after.frames - before.frames);
}

export const readHeaps = (pages) => Promise.all(pages.map((page) => page.evaluate('Math.round(performance.memory.usedJSHeapSize/1048576)')));

export function summarizeFrames(frameSamples) {
  return [...frameSamples.entries()].map(([label, samples]) => ({
    label,
    minimum: Math.min(...samples),
    average: Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length),
  }));
}
