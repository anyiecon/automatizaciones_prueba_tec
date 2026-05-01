import { describe, expect, it } from 'vitest';
import { classifyMetric, DEFAULT_THRESHOLDS } from '../src/domain/threshold-policy.js';

describe('classifyMetric', () => {
  it('returns critical when metric is below the critical threshold', () => {
    expect(classifyMetric(0.5)).toBe('critical');
    expect(classifyMetric(0.99999)).toBe('critical');
  });

  it('returns warning at the critical boundary (inclusive lower bound)', () => {
    expect(classifyMetric(1.0)).toBe('warning');
  });

  it('returns warning between critical and warning thresholds', () => {
    expect(classifyMetric(2.0)).toBe('warning');
    expect(classifyMetric(2.49999)).toBe('warning');
  });

  it('returns ok at and above the warning threshold', () => {
    expect(classifyMetric(2.5)).toBe('ok');
    expect(classifyMetric(10)).toBe('ok');
  });

  it('respects custom thresholds', () => {
    const custom = { warning: 5, critical: 2 };
    expect(classifyMetric(1, custom)).toBe('critical');
    expect(classifyMetric(3, custom)).toBe('warning');
    expect(classifyMetric(7, custom)).toBe('ok');
  });

  it('rejects non-finite metrics', () => {
    expect(() => classifyMetric(Number.NaN)).toThrow(RangeError);
    expect(() => classifyMetric(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('rejects invalid threshold ordering', () => {
    expect(() => classifyMetric(1, { warning: 1, critical: 2 })).toThrow(RangeError);
  });

  it('uses defaults of warning=2.5 and critical=1.0', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ warning: 2.5, critical: 1.0 });
  });
});
