import type { CampaignEvaluationPayload } from '../../domain/campaign-report.js';
import { HttpStatusError, NetworkError, TimeoutError } from '../../domain/errors.js';
import type { ICampaignWorkflowNotifier } from './campaign-workflow-notifier.js';

export type N8nWebhookNotifierOptions = {
  readonly webhookUrl: string;
  readonly timeoutMs: number;
};

export class N8nWebhookNotifier implements ICampaignWorkflowNotifier {
  readonly name = 'n8n-webhook';

  constructor(private readonly options: N8nWebhookNotifierOptions) {}

  async notify(payload: CampaignEvaluationPayload): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(this.options.webhookUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(this.toWebhookBody(payload)),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HttpStatusError(
          response.status,
          `POST ${this.options.webhookUrl} failed with status ${response.status}`,
        );
      }
    } catch (error) {
      if (error instanceof HttpStatusError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`POST ${this.options.webhookUrl} timed out after ${this.options.timeoutMs}ms`, {
          cause: error,
        });
      }
      throw new NetworkError(`Network failure on POST ${this.options.webhookUrl}`, { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }

  private toWebhookBody(payload: CampaignEvaluationPayload): unknown {
    return {
      source: payload.source,
      generatedAt: payload.generatedAt.toISOString(),
      count: payload.count,
      reports: payload.reports.map((report) => ({
        ...report,
        evaluatedAt: report.evaluatedAt.toISOString(),
      })),
    };
  }
}
