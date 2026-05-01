import type { CampaignEvaluationPayload } from '../../domain/campaign-report.js';

/**
 * Puerto de salida hacia automatizaciones externas como N8N.
 * Mantiene la Parte 1 desacoplada del proveedor concreto de workflow.
 */
export interface ICampaignWorkflowNotifier {
  readonly name: string;
  notify(payload: CampaignEvaluationPayload): Promise<void>;
}
