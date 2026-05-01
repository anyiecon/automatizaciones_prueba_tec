import type { CampaignEvaluationPayload } from '../../domain/campaign-report.js';

/**
 * Puerto de persistencia del payload evaluado.
 * Cambiar el almacenamiento (JSON, SQLite, Postgres) = nueva implementacion; el nucleo no cambia.
 */
export interface ICampaignRepository {
  /** Persiste el payload completo. La implementacion debe ser atomica. */
  save(payload: CampaignEvaluationPayload): Promise<void>;
}
