import type { RawCampaign } from '../../domain/campaign-report.js';

export type FetchCampaignsParams = {
  readonly limit?: number;
};

/**
 * Puerto de entrada de datos de campañas.
 * Agregar una nueva fuente = nueva clase que implementa esta interfaz; el nucleo no cambia.
 */
export interface ICampaignDataSource {
  /** Identificador legible de la fuente (ej. "dummyjson"). Se persiste junto al output. */
  readonly name: string;

  /**
   * Obtiene campañas crudas de la fuente externa.
   * @throws {NetworkError | TimeoutError | HttpStatusError} fallos de transporte.
   * @throws {ValidationError} si la respuesta no cumple el schema esperado.
   * @throws {RetryExhaustedError} si los reintentos transitorios se agotan.
   */
  fetchCampaigns(params?: FetchCampaignsParams): Promise<RawCampaign[]>;
}
