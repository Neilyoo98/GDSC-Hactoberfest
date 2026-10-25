import 'server-only';

import type { TraceStep } from '@/shared/types';

const traces = new Map<number, TraceStep[]>();
const MAX_TRACES = 100;

export function startTrace(marketId: number): void {
  traces.delete(marketId);
  traces.set(marketId, []);
  while (traces.size > MAX_TRACES) {
    const oldest = traces.keys().next().value;
    if (oldest === undefined) break;
    traces.delete(oldest);
  }
}

export function addTrace(
  marketId: number,
  step: TraceStep['step'],
  detail: string,
): void {
  const trace = traces.get(marketId) ?? [];
  trace.push({ at: Date.now(), step, detail: detail.slice(0, 500) });
  traces.set(marketId, trace);
}

export function getTrace(marketId: number): TraceStep[] {
  return [...(traces.get(marketId) ?? [])];
}
