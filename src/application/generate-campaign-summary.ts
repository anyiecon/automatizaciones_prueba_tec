import type { CampaignReport } from '../domain/campaign-report.js';
import type { LLMSummary } from '../domain/llm-summary.js';
import { DomainError } from '../domain/errors.js';
import type { ICampaignLlmClient } from '../infrastructure/llm/llm-client.js';

export type GenerateSummaryDeps = {
  readonly llmClient: ICampaignLlmClient;
  readonly logger?: { info: (msg: string, ctx?: Record<string, unknown>) => void; warn: (msg: string, ctx?: Record<string, unknown>) => void };
};

/**
 * Genera un resumen ejecutivo de las campañas usando el cliente LLM configurado.
 * Si el LLM falla, retorna un resumen de fallback sin romper el flujo.
 */
export async function generateCampaignSummary(
  reports: readonly CampaignReport[],
  deps: GenerateSummaryDeps,
): Promise<LLMSummary> {
  try {
    const summary = await deps.llmClient.generateSummary(reports);
    deps.logger?.info('llm summary generated', {
      model: summary.model,
      hasStructured: summary.structured !== undefined,
    });
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.logger?.warn('llm summary failed, returning fallback', { error: message });
    return buildFallbackSummary(reports, deps.llmClient.model, error);
  }
}

function buildFallbackSummary(
  reports: readonly CampaignReport[],
  model: string,
  cause: unknown,
): LLMSummary {
  const critical = reports.filter((r) => r.status === 'critical');
  const warning = reports.filter((r) => r.status === 'warning');
  const errorMessage = cause instanceof DomainError ? cause.message : 'LLM unavailable';

  const summary = [
    `No se pudo contactar al LLM (${errorMessage}).`,
    `Resumen automatico: ${reports.length} campañas evaluadas.`,
    critical.length > 0
      ? `${critical.length} en estado critico: ${critical.map((r) => r.name).join(', ')}.`
      : 'Sin campañas criticas.',
    warning.length > 0 ? `${warning.length} en estado warning.` : 'Sin campañas en warning.',
  ].join(' ');

  return {
    generatedAt: new Date(),
    model,
    summary,
    rawResponse: cause instanceof Error ? { error: cause.message } : undefined,
  };
}

/**
 * Construye el mensaje de usuario para el LLM con los datos de las campañas.
 * Exportado para poder testearlo y reutilizarlo desde el cliente.
 */
export function buildCampaignPrompt(reports: readonly CampaignReport[]): string {
  const critical = reports.filter((r) => r.status === 'critical');
  const warning = reports.filter((r) => r.status === 'warning');
  const ok = reports.filter((r) => r.status === 'ok');

  return JSON.stringify(
    {
      total: reports.length,
      critical: critical.map((r) => ({ id: r.id, name: r.name, metric: r.metric })),
      warning_count: warning.length,
      ok_count: ok.length,
    },
    null,
    2,
  );
}
