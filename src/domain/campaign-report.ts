/** Estados posibles de una campana segun la metrica evaluada. */
export type CampaignStatus = 'ok' | 'warning' | 'critical';

/**
 * Reporte tipado de campana - estructura exigida por el enunciado (Parte 1, paso 2).
 * Es el contrato que consumen las Partes 2, 3 y 4.
 */
export type CampaignReport = {
  id: string;
  name: string;
  metric: number;
  status: CampaignStatus;
  evaluatedAt: Date;
};

/** Payload completo que comparten la salida local y el webhook de N8N. */
export type CampaignEvaluationPayload = {
  source: string;
  generatedAt: Date;
  count: number;
  reports: readonly CampaignReport[];
};

/** Forma cruda independiente de la fuente - la produce cualquier `ICampaignDataSource`. */
export type RawCampaign = {
  id: string;
  name: string;
  metric: number;
};
