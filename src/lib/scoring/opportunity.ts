function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function logNorm(value: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  const numerator = Math.log(1 + value) - Math.log(1 + min);
  const denominator = Math.log(1 + max) - Math.log(1 + min);
  return clamp(numerator / denominator, 0, 1);
}

export function normalizeTo01(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max <= min) return values.map(() => 0.5);
  return values.map((value) => clamp((value - min) / (max - min), 0, 1));
}
