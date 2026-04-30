import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { loadPrompt, interpolatePrompt } from '../../../shared/utils/prompt-loader';

export interface KeywordResearch {
  coreKeywords: Array<{
    keyword: string;
    volume: number | null;
    difficulty: number | null;
    confidence: 'high' | 'medium';
    reason: string;
  }>;
  moneyKeywords: Array<{
    keyword: string;
    volume: number | null;
    difficulty: number | null;
    intent: string;
    mappedService: string;
  }>;
  primaryTopics: Array<{
    pillar: string;
    clusterKeywords: string[];
    estimatedTotalVolume: number;
  }>;
  nicheEntities: Array<{
    entity: string;
    type: 'person' | 'brand' | 'tool' | 'methodology' | 'platform' | 'concept';
    relevance: string;
  }>;
  seedExpansions: string[];
  coreTopics: Array<{
    topicName: string;
    type: 'service' | 'keyword' | 'content' | 'entity';
    relatedTerms: string[];
    intent: 'informational' | 'commercial' | 'transactional';
    mappedTo: string | null;
  }>;
}

export interface KeywordResearchSteps {
  step31: Step31Output | null;
  step32: Step32Output | null;
  step33: Step33Output | null;
  step34: Step34Output | null;
  step35: Step35Output | null;
}

interface Step31Output {
  offerings: string[];
  offeringTerminology: string[];
  conversionPhrases: string[];
  pageMapping: Array<{ url: string; intent: string }>;
}

interface Step32Output {
  coreKeywords: KeywordResearch['coreKeywords'];
  moneyKeywords: KeywordResearch['moneyKeywords'];
}

interface Step33Output {
  primaryTopics: KeywordResearch['primaryTopics'];
  seedExpansions: string[];
}

interface Step34Output {
  entities: KeywordResearch['nicheEntities'];
}

interface Step35Output {
  coreTopics: KeywordResearch['coreTopics'];
}

export interface BusinessProfile {
  brandIdentity: string;
  targetMarket: string;
  operationalModel: string;
  services: string[];
  geography: string;
  toneOfVoice: string;
  seedKeywords: string[];
  serviceAreas?: Array<{ area: string; region: string; country: string }>;
}

export interface DeepRead {
  whatTheySell: string;
  whoTheyServe: string;
  howTheyPosition: string;
  whatMakesThemDifferent: string;
}

export interface CompetitorClassification {
  directCompetitors: Array<{ domain: string; reason: string }>;
  organicCompetitors: Array<{ domain: string; reason: string }>;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly client: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY', ''),
    });
  }

  async generateBusinessProfile(
    websiteContent: string,
    businessDescription: string,
  ): Promise<BusinessProfile> {
    this.logger.log('Generating business profile via OpenAI GPT-5.4');

    const systemPrompt = `You are a clear, intellectual Data-based Marketeer with a keen eye for business analysis and strategy. Your expertise lies in distilling complex information into actionable insights. Your communication style is concise yet comprehensive, always grounded in data and objective analysis. Respond ONLY in valid JSON.`;

    const userPrompt = `Your task is to analyze the provided website content and generate a detailed business profile. This profile should capture the essence of the business, its target market, its operational model, and the Tonality of the brand. Your analysis should be thorough, drawing insights directly from the given text to ensure accuracy and relevance.

Website content:
${websiteContent.slice(0, 3000)}

Business description provided by the owner:
${businessDescription}

Return a JSON object with these exact keys:
{
  "brandIdentity": "string — brand positioning and what makes them unique",
  "targetMarket": "string — who they serve, demographics, psychographics",
  "operationalModel": "string — how the business operates, delivery model",
  "services": ["array of specific services or products offered"],
  "geography": "string — geographic focus or service areas",
  "toneOfVoice": "string — brand communication style and tone",
  "seedKeywords": ["5-10 primary keywords that define this business"],
  "serviceAreas": [{"area": "specific city, state, or locality", "region": "broader region or state", "country": "country name"}]
}

For serviceAreas: Extract ALL geographic areas the business serves, as granular as possible. Include every city, state, or locality mentioned or implied. If only a broad region is mentioned (e.g. "MENA"), expand it into the key countries and major cities within that region. Always go as deep as the content allows — city level is ideal. Each entry must have area (most granular), region (broader grouping), and country.`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-5.4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned empty response for business profile');
    }

    const parsed = JSON.parse(content) as BusinessProfile;
    this.logger.log(`Business profile generated: ${parsed.services.length} services, ${parsed.seedKeywords.length} seed keywords`);
    return parsed;
  }

  async generateDeepRead(profile: BusinessProfile): Promise<DeepRead> {
    this.logger.log('Generating deep-read distillation via OpenAI GPT-5.4');

    const systemPrompt = `You are a senior brand strategist. Given a business profile, distill it into four crisp answers. Be specific and evidence-based — no filler. Respond ONLY in valid JSON.`;

    const userPrompt = `Business Profile:
Brand Identity: ${profile.brandIdentity}
Target Market: ${profile.targetMarket}
Operational Model: ${profile.operationalModel}
Services: ${profile.services.join(', ')}
Geography: ${profile.geography}
Tone of Voice: ${profile.toneOfVoice}

Answer these four questions in 1-2 sentences each:

Return a JSON object with these exact keys:
{
  "whatTheySell": "What do they sell? List core products/services and delivery model.",
  "whoTheyServe": "Who do they serve? Target audience, segments, geography.",
  "howTheyPosition": "How do they position themselves? Brand narrative and market angle.",
  "whatMakesThemDifferent": "What makes them different from competitors? Specific differentiators."
}`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-5.4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      throw new Error('OpenAI returned empty response for deep-read');
    }

    const parsed = JSON.parse(raw) as DeepRead;
    this.logger.log('Deep-read distillation complete');
    return parsed;
  }

  async classifyKeywords(
    profile: BusinessProfile,
    deepRead: DeepRead,
    ahrefsKeywords: Array<{ keyword: string; volume: number | null; difficulty: number | null; traffic: number | null; intent: Record<string, boolean> }> | null,
    scrapeBodyText?: string,
    onProgress?: (pct: number, subStepKey: string, partialSteps: KeywordResearchSteps) => Promise<void>,
  ): Promise<{ research: KeywordResearch; steps: KeywordResearchSteps }> {
    this.logger.log('Starting 5-step keyword intelligence chain via GPT-5.4');

    const steps: KeywordResearchSteps = { step31: null, step32: null, step33: null, step34: null, step35: null };

    // Step 3.1 — Website Context Extraction
    try {
      steps.step31 = await this.kwStep31(profile, deepRead, scrapeBodyText || '');
      this.logger.log(`Step 3.1 complete: ${steps.step31.offerings.length} offerings extracted`);
    } catch (e) {
      this.logger.error(`Step 3.1 failed: ${e}`);
    }
    if (onProgress) await onProgress(34, 'KW_STEP_31', { ...steps });

    // Step 3.2 — Core + Money Keywords
    try {
      steps.step32 = await this.kwStep32(profile, deepRead, steps.step31, ahrefsKeywords);
      this.logger.log(`Step 3.2 complete: ${steps.step32.coreKeywords.length} core, ${steps.step32.moneyKeywords.length} money`);
    } catch (e) {
      this.logger.error(`Step 3.2 failed: ${e}`);
    }
    if (onProgress) await onProgress(36, 'KW_STEP_32', { ...steps });

    // Step 3.3 — Topic Clusters + Expansion
    try {
      steps.step33 = await this.kwStep33(profile, deepRead, steps.step32);
      this.logger.log(`Step 3.3 complete: ${steps.step33.primaryTopics.length} topics, ${steps.step33.seedExpansions.length} expansions`);
    } catch (e) {
      this.logger.error(`Step 3.3 failed: ${e}`);
    }
    if (onProgress) await onProgress(38, 'KW_STEP_33', { ...steps });

    // Step 3.4 — Entity Discovery
    try {
      steps.step34 = await this.kwStep34(steps.step32, steps.step33);
      this.logger.log(`Step 3.4 complete: ${steps.step34.entities.length} entities`);
    } catch (e) {
      this.logger.error(`Step 3.4 failed: ${e}`);
    }
    if (onProgress) await onProgress(40, 'KW_STEP_34', { ...steps });

    // Step 3.5 — Deduplication + Core Topics
    try {
      steps.step35 = await this.kwStep35(steps.step32, steps.step33, steps.step34);
      this.logger.log(`Step 3.5 complete: ${steps.step35.coreTopics.length} core topics`);
    } catch (e) {
      this.logger.error(`Step 3.5 failed: ${e}`);
    }
    if (onProgress) await onProgress(44, 'KW_STEP_35', { ...steps });

    // Merge all step outputs into final result
    const research: KeywordResearch = {
      coreKeywords: steps.step32?.coreKeywords ?? [],
      moneyKeywords: steps.step32?.moneyKeywords ?? [],
      primaryTopics: steps.step33?.primaryTopics ?? [],
      nicheEntities: steps.step34?.entities ?? [],
      seedExpansions: steps.step33?.seedExpansions ?? [],
      coreTopics: steps.step35?.coreTopics ?? [],
    };

    this.logger.log(
      `Keyword intelligence chain complete: ${research.coreKeywords.length} core, ${research.moneyKeywords.length} money, ${research.primaryTopics.length} topics, ${research.nicheEntities.length} entities, ${research.coreTopics.length} core topics`,
    );
    return { research, steps };
  }

  /* ── Private helpers for 5-step keyword chain ──────────── */

  private async callGpt(system: string, user: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-5.4',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('OpenAI returned empty response');
    return raw;
  }

  private async kwStep31(profile: BusinessProfile, deepRead: DeepRead, bodyText: string): Promise<Step31Output> {
    const { system, user } = loadPrompt('Keyword & Topic Intelligence Layer/3.1 - Website Context Extraction Prompt.md');
    const interpolated = interpolatePrompt(user, {
      deepRead,
      profile: {
        services: profile.services.join(', '),
        geography: profile.geography,
        targetMarket: profile.targetMarket,
      },
      bodyText: bodyText.slice(0, 3000),
    });
    return JSON.parse(await this.callGpt(system, interpolated)) as Step31Output;
  }

  private async kwStep32(
    profile: BusinessProfile,
    deepRead: DeepRead,
    step31: Step31Output | null,
    ahrefsKeywords: Array<{ keyword: string; volume: number | null; difficulty: number | null; traffic: number | null; intent: Record<string, boolean> }> | null,
  ): Promise<Step32Output> {
    const { system, user } = loadPrompt('Keyword & Topic Intelligence Layer/3.2 - Core + Money Keywords Prompt.md');

    let ahrefsSection: string;
    if (ahrefsKeywords && ahrefsKeywords.length > 0) {
      ahrefsSection = `AHREFS KEYWORD DATA (real metrics):\n${JSON.stringify(ahrefsKeywords.slice(0, 100), null, 0)}`;
    } else {
      ahrefsSection = `SEED KEYWORDS (no Ahrefs data — infer from context, use null for volume/difficulty):\n${profile.seedKeywords.join(', ')}`;
    }

    const interpolated = interpolatePrompt(user, {
      offerings: step31?.offerings?.join(', ') || profile.services.join(', '),
      terminology: step31?.offeringTerminology?.join(', ') || '',
      conversionPhrases: step31?.conversionPhrases?.join(', ') || '',
      deepRead,
      profile: { services: profile.services.join(', '), geography: profile.geography },
      ahrefsSection,
    });
    return JSON.parse(await this.callGpt(system, interpolated)) as Step32Output;
  }

  private async kwStep33(
    profile: BusinessProfile,
    deepRead: DeepRead,
    step32: Step32Output | null,
  ): Promise<Step33Output> {
    const { system, user } = loadPrompt('Keyword & Topic Intelligence Layer/3.3 - Topic Clusters + Expansion Prompt.md');
    const interpolated = interpolatePrompt(user, {
      coreKeywords: step32?.coreKeywords?.map(k => k.keyword).join(', ') || profile.seedKeywords.join(', '),
      moneyKeywords: step32?.moneyKeywords?.map(k => k.keyword).join(', ') || '',
      deepRead,
      profile: { services: profile.services.join(', '), geography: profile.geography },
    });
    return JSON.parse(await this.callGpt(system, interpolated)) as Step33Output;
  }

  private async kwStep34(
    step32: Step32Output | null,
    step33: Step33Output | null,
  ): Promise<Step34Output> {
    const { system, user } = loadPrompt('Keyword & Topic Intelligence Layer/3.4 - Entity Discovery Prompt.md');
    const interpolated = interpolatePrompt(user, {
      coreKeywords: step32?.coreKeywords?.map(k => k.keyword).join(', ') || '',
      moneyKeywords: step32?.moneyKeywords?.map(k => k.keyword).join(', ') || '',
      primaryTopics: step33?.primaryTopics?.map(t => t.pillar).join(', ') || '',
      seedExpansions: step33?.seedExpansions?.join(', ') || '',
    });
    return JSON.parse(await this.callGpt(system, interpolated)) as Step34Output;
  }

  private async kwStep35(
    step32: Step32Output | null,
    step33: Step33Output | null,
    step34: Step34Output | null,
  ): Promise<Step35Output> {
    const { system, user } = loadPrompt('Keyword & Topic Intelligence Layer/3.5 - Deduplication + Core Topics Prompt.md');
    const interpolated = interpolatePrompt(user, {
      coreKeywords: JSON.stringify(step32?.coreKeywords?.map(k => k.keyword) || []),
      moneyKeywords: JSON.stringify(step32?.moneyKeywords?.map(k => ({ keyword: k.keyword, mappedService: k.mappedService })) || []),
      primaryTopics: JSON.stringify(step33?.primaryTopics?.map(t => ({ pillar: t.pillar, clusters: t.clusterKeywords })) || []),
      seedExpansions: JSON.stringify(step33?.seedExpansions || []),
      entities: JSON.stringify(step34?.entities?.map(e => ({ entity: e.entity, type: e.type })) || []),
    });
    return JSON.parse(await this.callGpt(system, interpolated)) as Step35Output;
  }

  async classifyCompetitors(
    candidates: Array<{ domain: string; occurrences: number; positions: number[] }>,
    profile: BusinessProfile,
    deepRead: DeepRead,
  ): Promise<CompetitorClassification> {
    this.logger.log(`Classifying ${candidates.length} competitor candidates via GPT-5.4`);

    const { system, user } = loadPrompt('4.0 - Competitor Classification Prompt.md');
    const interpolated = interpolatePrompt(user, {
      profile: {
        brandIdentity: profile.brandIdentity,
        services: profile.services.join(', '),
        targetMarket: profile.targetMarket,
        geography: profile.geography,
      },
      deepRead,
      candidatesJson: JSON.stringify(
        candidates.map(c => ({ domain: c.domain, occurrences: c.occurrences, avgPosition: Math.round(c.positions.reduce((a, b) => a + b, 0) / c.positions.length) })),
        null, 2,
      ),
    });

    const parsed = JSON.parse(await this.callGpt(system, interpolated)) as CompetitorClassification;
    this.logger.log(
      `Competitor classification complete: ${parsed.directCompetitors.length} direct, ${parsed.organicCompetitors.length} organic`,
    );
    return parsed;
  }

  async generateReportCopy(auditData: Record<string, unknown>) {
    this.logger.log('Generating report copy via OpenAI GPT-5.4');
    // TODO: Implement report narrative generation
    return '';
  }

  async generateContentBrief(keyword: string, context: Record<string, unknown>) {
    this.logger.log(`Generating content brief for "${keyword}"`);
    // TODO: Implement content brief generation
    return { targetKeyword: keyword, title: '', metaDescription: '', headings: [], wordCount: 0, internalLinks: [], competitorUrls: [], notes: '' };
  }

  async generateArticle(brief: Record<string, unknown>) {
    this.logger.log('Generating full article via OpenAI GPT-5.4');
    // TODO: Implement E-E-A-T structured article generation
    return '';
  }
}
