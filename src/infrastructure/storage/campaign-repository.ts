import type { CampaignReport } from '../../domain/campaign-report.js';

/**
 * Puerto de persistencia de reportes evaluados.
 * Cambiar el almacenamiento (JSON, SQLite, Postgres) = nueva implementacion; el nucleo no cambia.
 */
export interface ICampaignRepository {
  /** Persiste el conjunto completo de reportes. La implementacion debe ser atomica. */
  save(reports: readonly CampaignReport[]): Promise<void>;
}
