import { z } from 'zod';
import type { CampaignReport } from '../../domain/campaign-report.js';
import { HttpStatusError, NetworkError, TimeoutError } from '../../domain/errors.js';
import type { LLMSummary, StructuredSummary } from '../../domain/llm-summary.js';
import { buildCampaignPrompt } from '../../application/generate-campaign-summary.js';
import type { ICampaignLlmClient } from './llm-client.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

const ChoiceSchema = z.object({
  message: z.object({
    role: z.string(),
    content: z.string().nullable(),
  }),
  finish_reason: z.string().nullable(),
});

const OpenRouterResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  choices: z.array(ChoiceSchema).min(1),
});

const StructuredSummarySchema = z.object({
  summary: z.string().min(1),
  criticalCampaigns: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      metric: z.number(),
      suggestedAction: z.string(),
    }),
  ),
  warningSummary: z.string(),
  suggestedActions: z.array(z.string()).min(1),
});

export type OpenRouterClientOptions = {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly siteUrl?: string;
};

export class OpenRouterClient implements ICampaignLlmClient {
  readonly model: string;

  constructor(private readonly options: OpenRouterClientOptions) {
    this.model = options.model;
  }

  async generateSummary(reports: readonly CampaignReport[]): Promise<LLMSummary> {
    const generatedAt = new Date();
    const rawResponse = await this.callApi(reports);
    const content = rawResponse.choices[0]?.message.content ?? '';
    const structured = tryParseStructured(content);

    return {
      generatedAt,
      model: rawResponse.model,
      summary: structured?.summary ?? content,
      structured: structured
        ? {
            criticalCampaigns: structured.criticalCampaigns,
            warningSummary: structured.warningSummary,
            suggestedActions: structured.suggestedActions,
          }
        : undefined,
      rawResponse,
    };
  }

  private async callApi(reports: readonly CampaignReport[]): Promise<z.infer<typeof OpenRouterResponseSchema>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await fetch(OPENROUTER_BASE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.options.apiKey}`,
          ...(this.options.siteUrl ? { 'http-referer': this.options.siteUrl } : {}),
        },
        body: JSON.stringify({
          model: this.options.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildCampaignPrompt(reports) },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new HttpStatusError(
          response.status,
          `OpenRouter responded with ${response.status}${errorBody ? `: ${errorBody}` : ''}`,
        );
      }

      const body: unknown = await response.json();
      const parsed = OpenRouterResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new NetworkError('OpenRouter response did not match expected schema', { cause: parsed.error });
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof HttpStatusError || error instanceof NetworkError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`OpenRouter request timed out after ${this.options.timeoutMs}ms`, { cause: error });
      }
      throw new NetworkError('Network failure calling OpenRouter', { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }
}

function tryParseStructured(content: string): z.infer<typeof StructuredSummarySchema> | undefined {
  try {
    const parsed = StructuredSummarySchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

const SYSTEM_PROMPT = `You are an advertising campaign performance analyst.
Analyze the provided campaign data and respond ONLY with a valid JSON object using this exact schema:

{
  "summary": "Executive overview in Spanish (2-3 sentences)",
  "criticalCampaigns": [
    { "id": "string", "name": "string", "metric": number, "suggestedAction": "concrete action in Spanish" }
  ],
  "warningSummary": "General state of warning campaigns in Spanish",
  "suggestedActions": ["Concrete action 1 in Spanish", "Concrete action 2 in Spanish"]
}

Rules:
- Highlight every campaign with status critical and propose a specific corrective action for each.
- Summarize the warning campaigns as a group.
- Include at least two concrete suggested actions.
- Respond only in Spanish.
- Return only the JSON object, no markdown, no explanation outside the JSON.`;
