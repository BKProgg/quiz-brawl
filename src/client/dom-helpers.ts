export function queryElement<Element extends HTMLElement>(selector: string): Element {
  const element = document.querySelector<Element>(selector);
  if (!element) {
    throw new Error(`화면 요소를 찾을 수 없습니다: ${selector}`);
  }
  return element;
}
