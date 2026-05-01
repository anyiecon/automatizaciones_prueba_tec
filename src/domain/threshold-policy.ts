import type { CampaignStatus } from './campaign-report.js';

export type Thresholds = {
  readonly warning: number;
  readonly critical: number;
};

/** Umbrales del enunciado: warning < 2.5, critical < 1.0, ok >= 2.5. */
export const DEFAULT_THRESHOLDS: Thresholds = {
  warning: 2.5,
  critical: 1.0,
};

/**
 * Clasifica una metrica de campana segun los umbrales dados.
 * Funcion pura, sin I/O — testeable de forma aislada.
 *
 * @throws {RangeError} si la metrica no es finita o si critical >= warning.
 */
export function classifyMetric(metric: number, thresholds: Thresholds = DEFAULT_THRESHOLDS): CampaignStatus {
  if (!Number.isFinite(metric)) {
    throw new RangeError(`metric must be a finite number, received: ${String(metric)}`);
  }
  if (thresholds.critical >= thresholds.warning) {
    throw new RangeError('critical threshold must be strictly lower than warning threshold');
  }
  if (metric < thresholds.critical) return 'critical';
  if (metric < thresholds.warning) return 'warning';
  return 'ok';
}
