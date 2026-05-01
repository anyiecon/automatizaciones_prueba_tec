/** Los tres estados posibles de una campaña según cómo le fue con su métrica. */
export type CampaignStatus = 'ok' | 'warning' | 'critical';

/**
 * El reporte final de una campaña — la estructura que pide el enunciado.
 * Este tipo viaja desde la Parte 1 hasta N8N, Slack y Google Sheets.
 */
export type CampaignReport = {
  id: string;
  name: string;
  metric: number;
  status: CampaignStatus;
  evaluatedAt: Date;
};

/**
 * El sobre completo que sale del pipeline: metadatos + todos los reportes.
 * Es lo mismo que se guarda en disco y lo que se envía al webhook de N8N.
 */
export type CampaignEvaluationPayload = {
  source: string;
  generatedAt: Date;
  count: number;
  reports: readonly CampaignReport[];
};

/** Los datos en bruto que viene de cualquier fuente antes de evaluarlos. */
export type RawCampaign = {
  id: string;
  name: string;
  metric: number;
};
