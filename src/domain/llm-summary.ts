/** Una campana critica con la accion concreta sugerida por el LLM. */
export type CriticalCampaignAction = {
  readonly id: string;
  readonly name: string;
  readonly metric: number;
  readonly suggestedAction: string;
};

/** Parte estructurada del resumen — diferencial de la Parte 4. */
export type StructuredSummary = {
  readonly criticalCampaigns: readonly CriticalCampaignAction[];
  readonly warningSummary: string;
  readonly suggestedActions: readonly string[];
};

/** Resumen ejecutivo generado por el LLM sobre el estado de las campañas. */
export type LLMSummary = {
  readonly generatedAt: Date;
  readonly model: string;
  readonly summary: string;
  readonly structured?: StructuredSummary;
  readonly rawResponse?: unknown;
};
