import { z } from 'zod';
import { ValidationError } from '../domain/errors.js';
import { mapConcurrent } from '../infrastructure/concurrency/map-concurrent.js';

const DEFAULT_MAX_CONCURRENCY = 3;
const DEFAULT_LOW_CTR_THRESHOLD = 0.02;

const RemoteCampaignSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  clicks: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative(),
});

export type CampaignCtrResult = {
  readonly id: string;
  readonly clicks: number;
  readonly impressions: number;
  readonly ctr: number;
};

/** Dependencia de la fuente remota de datos de campana. Permite testear sin red. */
export type CampaignDataFetcher = {
  fetchCampaignData(campaignId: string): Promise<unknown>;
};

export type ProcessCampaignsOptions = {
  /** Maximo de peticiones simultaneas. Se capa en DEFAULT_MAX_CONCURRENCY = 3. */
  readonly concurrency?: number;
};

/**
 * Obtiene los datos de una campana, valida su forma y calcula el CTR.
 *
 * Problemas del codigo original que esta funcion corrige:
 * 1. Sin validacion — `response.data` era `any`; aqui se valida con Zod antes de usar los datos.
 * 2. Division por cero — `clicks / impressions` explotaba si impressions era 0.
 *
 * @throws {ValidationError} si el payload no cumple el schema o el CTR no puede calcularse.
 */
export async function fetchCampaignData(
  campaignId: string,
  fetcher: CampaignDataFetcher,
): Promise<CampaignCtrResult> {
  const raw = await fetcher.fetchCampaignData(campaignId);
  const parsed = RemoteCampaignSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(`Campaign ${campaignId} payload did not match expected schema`, {
      cause: parsed.error,
    });
  }

  return {
    ...parsed.data,
    ctr: calculateCtr(parsed.data.clicks, parsed.data.impressions),
  };
}

/**
 * Procesa multiples campanas con concurrencia controlada (maximo DEFAULT_MAX_CONCURRENCY = 3).
 *
 * Problema del codigo original que esta funcion corrige:
 * 3. Loop secuencial — el `for...of` con `await` procesaba una campana a la vez;
 *    aqui se usan hasta 3 peticiones simultaneas mediante `mapConcurrent`.
 *
 * @throws {RangeError} si `options.concurrency` no es un entero positivo.
 */
export async function processCampaigns(
  ids: readonly string[],
  fetcher: CampaignDataFetcher,
  options: ProcessCampaignsOptions = {},
): Promise<readonly CampaignCtrResult[]> {
  const concurrency = normalizeConcurrency(options.concurrency);
  return mapConcurrent(ids, concurrency, (id) => fetchCampaignData(id, fetcher));
}

/**
 * Filtra las campanas con CTR por debajo del umbral y las ordena de menor a mayor CTR.
 *
 * @throws {RangeError} si `threshold` no es un numero finito >= 0.
 */
export function findLowCtrCampaigns(
  results: readonly CampaignCtrResult[],
  threshold = DEFAULT_LOW_CTR_THRESHOLD,
): readonly CampaignCtrResult[] {
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new RangeError('threshold must be a finite number >= 0');
  }
  return [...results].filter((c) => c.ctr < threshold).sort((a, b) => a.ctr - b.ctr);
}

function calculateCtr(clicks: number, impressions: number): number {
  if (impressions === 0) {
    if (clicks === 0) return 0;
    throw new ValidationError('Campaign has clicks but zero impressions; CTR cannot be calculated');
  }
  return clicks / impressions;
}

function normalizeConcurrency(input: number | undefined): number {
  const requested = input ?? DEFAULT_MAX_CONCURRENCY;
  if (!Number.isInteger(requested) || requested < 1) {
    throw new RangeError('concurrency must be a positive integer');
  }
  return Math.min(requested, DEFAULT_MAX_CONCURRENCY);
}
