import type { CampaignReport } from '../../domain/campaign-report.js';
import type { LLMSummary } from '../../domain/llm-summary.js';

/**
 * Puerto de salida hacia cualquier proveedor de LLM.
 * Cambiar de OpenRouter a otro proveedor = nueva implementacion de esta interfaz.
 */
export interface ICampaignLlmClient {
  readonly model: string;
  generateSummary(reports: readonly CampaignReport[]): Promise<LLMSummary>;
}
