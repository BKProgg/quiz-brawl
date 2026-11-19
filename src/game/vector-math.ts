import type { Vector } from './game-types';

export const ZERO_VECTOR: Vector = { x: 0, y: 0 };

export function addVectors(first: Vector, second: Vector): Vector {
  return { x: first.x + second.x, y: first.y + second.y };
}

export function subtractVectors(first: Vector, second: Vector): Vector {
  return { x: first.x - second.x, y: first.y - second.y };
}

export function scaleVector(vector: Vector, factor: number): Vector {
  return { x: vector.x * factor, y: vector.y * factor };
}

export function getVectorLength(vector: Vector): number {
  return Math.hypot(vector.x, vector.y);
}

export function getDistance(first: Vector, second: Vector): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function normalizeVector(vector: Vector, fallback: Vector = ZERO_VECTOR): Vector {
  const length = getVectorLength(vector);
  return length === 0 ? { ...fallback } : { x: vector.x / length, y: vector.y / length };
}

export function getDotProduct(first: Vector, second: Vector): number {
  return first.x * second.x + first.y * second.y;
}

export function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
