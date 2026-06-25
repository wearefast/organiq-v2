import { Injectable, Logger, ConflictException, BadRequestException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { contentPieces } from '../../db/schema';
import { TopicalMapPagesService } from '../topical-maps/topical-map-pages.service';
import { OpenAiService } from '../integrations/openai/openai.service';
import { CreditsService } from '../credits/credits.service';

/** Credits charged per on-demand generation action */
const CREDIT_COSTS = { brief: 5, article: 10 } as const;

const BRIEF_SYSTEM_PROMPT = `You are an expert SEO content strategist.
Given a page's metadata, produce a structured content brief in JSON.
Return ONLY valid JSON matching the schema — no prose outside it.`;

function buildBriefPrompt(page: {
  title: string;
  keyword?: string | null;
  pillarTitle: string;
  clusterTitle: string;
  intent?: string | null;
  funnelStage?: string | null;
  contentType?: string | null;
  volume?: number | null;
  difficulty?: number | null;
  estimatedWordCount?: number | null;
  suggestedUrl?: string | null;
  linksTo?: string[] | null;
  linksFrom?: string[] | null;
}): string {
  return `Create a content brief for the following page:

Title: ${page.title}
Primary keyword: ${page.keyword ?? page.title}
Pillar: ${page.pillarTitle}
Cluster: ${page.clusterTitle}
Search intent: ${page.intent ?? 'informational'}
Funnel stage: ${page.funnelStage ?? 'TOFU'}
Content type: ${page.contentType ?? 'article'}
Search volume: ${page.volume ?? 'unknown'}
Keyword difficulty: ${page.difficulty ?? 'unknown'}
Target word count: ${page.estimatedWordCount ?? 1200}
Suggested URL: ${page.suggestedUrl ?? '(use best practice slug)'}
${page.linksTo?.length ? `Internal links TO: ${page.linksTo.join(', ')}` : ''}
${page.linksFrom?.length ? `Internal links FROM: ${page.linksFrom.join(', ')}` : ''}

Return a JSON object with this exact structure:
{
  "title": "exact SEO title tag (50-60 chars)",
  "metaDescription": "compelling meta description (150-160 chars)",
  "targetKeyword": "primary keyword",
  "secondaryKeywords": ["keyword2", "keyword3"],
  "intent": "transactional|commercial|informational|navigational",
  "funnelStage": "TOFU|MOFU|BOFU",
  "targetWordCount": 1200,
  "contentType": "article|guide|listicle|landing-page|comparison",
  "tone": "professional|conversational|authoritative",
  "outline": [
    {
      "heading": "H2 section heading",
      "type": "h2",
      "notes": "what this section should cover",
      "wordCount": 200
    }
  ],
  "keyPoints": ["important point 1", "important point 2"],
  "callToAction": "what you want the reader to do after reading",
  "internalLinks": ["url-to-link-to"],
  "contentGaps": ["topic competitor covers that we should address"],
  "eeatSignals": ["expertise/authority signals to include"]
}`;
}

@Injectable()
export class ContentGenerationService {
  private readonly logger = new Logger(ContentGenerationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly topicalMapPagesService: TopicalMapPagesService,
    private readonly openAiService: OpenAiService,
    private readonly creditsService: CreditsService,
  ) {}

  /**
   * Generates a content brief for a specific topical map page via a direct LLM call.
   * Idempotent — returns the existing brief if one already exists for this page.
   */
  async generateBriefForPage(
    pageId: string,
    projectId: string,
    organizationId: string,
  ): Promise<typeof contentPieces.$inferSelect> {
    const page = await this.topicalMapPagesService.findById(pageId, projectId);

    // Return existing brief if present (idempotent)
    const existingBrief = page.contentPieces.find((p) => p.type === 'brief');
    if (existingBrief) return existingBrief;

    // Credit gate — check before calling LLM
    const hasCredits = await this.creditsService.hasCredits(organizationId, CREDIT_COSTS.brief);
    if (!hasCredits) {
      throw new BadRequestException(`Insufficient credits — brief generation requires ${CREDIT_COSTS.brief} credits`);
    }

    this.logger.log(`Generating brief for page "${page.title}" (${pageId})`);

    const result = await this.openAiService.chatCompletion({
      messages: [
        { role: 'system', content: BRIEF_SYSTEM_PROMPT },
        { role: 'user', content: buildBriefPrompt(page) },
      ],
      model: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 4000,
    });

    let briefData: unknown;
    try {
      const raw = result.message.content ?? '{}';
      // Strip markdown code fences if model wraps output
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
      briefData = JSON.parse(cleaned);
    } catch {
      this.logger.warn(`Brief JSON parse failed for page ${pageId}, storing raw text`);
      briefData = { raw: result.message.content };
    }

    const inserted = await this.db.db
      .insert(contentPieces)
      .values({
        projectId,
        topicalMapId: page.topicalMapId,
        topicalMapPageId: pageId,
        type: 'brief',
        status: 'draft',
        title: page.title,
        briefData,
      })
      .onConflictDoNothing()
      .returning();

    // If a concurrent request already inserted a brief, fetch it
    const piece = inserted[0] ?? await this.db.db.query.contentPieces.findFirst({
      where: (cp, { and: a, eq: e }) => a(e(cp.topicalMapPageId, pageId), e(cp.type, 'brief')),
    });
    if (!piece) throw new Error(`Failed to create or find brief for page ${pageId}`);

    // Deduct credits only when a new brief was actually created
    if (inserted[0]) {
      await this.creditsService.debit({
        organizationId,
        amount: CREDIT_COSTS.brief,
        description: `Content brief generated for page: ${page.title}`,
      }).catch((e: unknown) =>
        this.logger.error(`Credit debit failed for brief ${piece.id}: ${e}`),
      );
    }

    this.logger.log(`Brief created: ${piece.id} for page ${pageId}`);
    return piece;
  }

  /**
   * Generates a full article from the page's existing brief.
   * Throws if no brief exists yet.
   */
  async generateArticleForPage(
    pageId: string,
    projectId: string,
    organizationId: string,
  ): Promise<typeof contentPieces.$inferSelect> {
    const page = await this.topicalMapPagesService.findById(pageId, projectId);

    const brief = page.contentPieces.find((p) => p.type === 'brief');
    if (!brief) {
      throw new ConflictException('Generate a brief first before generating the article');
    }

    // Return existing article (idempotent)
    const existingArticle = page.contentPieces.find((p) => p.type === 'article');
    if (existingArticle) return existingArticle;

    // Credit gate — check before calling LLM
    const hasCredits = await this.creditsService.hasCredits(organizationId, CREDIT_COSTS.article);
    if (!hasCredits) {
      throw new BadRequestException(`Insufficient credits — article generation requires ${CREDIT_COSTS.article} credits`);
    }

    this.logger.log(`Generating article for page "${page.title}" (${pageId})`);

    // Extract key fields from brief to avoid truncated JSON in the prompt
    const briefFields = brief.briefData as Record<string, unknown> | null | undefined;
    const briefContext = [
      `Title: ${briefFields?.title ?? page.title}`,
      `Primary keyword: ${briefFields?.targetKeyword ?? page.keyword ?? page.title}`,
      `Target word count: ${briefFields?.targetWordCount ?? page.estimatedWordCount ?? 1200}`,
      `Content type: ${briefFields?.contentType ?? page.contentType ?? 'article'}`,
      `Tone: ${briefFields?.tone ?? 'professional'}`,
      `Intent: ${briefFields?.intent ?? page.intent ?? 'informational'}`,
      `Funnel stage: ${briefFields?.funnelStage ?? page.funnelStage ?? 'TOFU'}`,
      `Meta description: ${briefFields?.metaDescription ?? ''}`,
      `Key points: ${Array.isArray(briefFields?.keyPoints) ? (briefFields.keyPoints as string[]).join('; ') : ''}`,
      `Call to action: ${briefFields?.callToAction ?? ''}`,
      `Outline:\n${Array.isArray(briefFields?.outline)
        ? (briefFields.outline as Array<{ heading: string; type: string; notes?: string; wordCount?: number }>)
            .map((s) => `  ${s.type.toUpperCase()}: ${s.heading}${s.notes ? ` — ${s.notes}` : ''}${s.wordCount ? ` (~${s.wordCount} words)` : ''}`)
            .join('\n')
        : '(see brief)'
      }`,
    ].join('\n');

    const result = await this.openAiService.chatCompletion({
      messages: [
        {
          role: 'system',
          content: `You are an expert SEO content writer. Write a complete, publication-ready article based on the provided brief.
Write in markdown format. Include all headings, paragraphs, and internal linking suggestions.
Return ONLY the markdown article — no preamble or explanation.`,
        },
        {
          role: 'user',
          content: `Write the full article based on this brief:\n\n${briefContext}

Requirements:
- Follow the outline exactly
- Match the target word count (within 10%)
- Use the primary keyword naturally in the first 100 words
- Include H2/H3 headings matching the brief outline
- Add a clear CTA at the end
- Write in the specified tone`,
        },
      ],
      model: 'gpt-4o',
      temperature: 0.4,
      maxTokens: 8000,
    });

    const articleMarkdown = result.message.content ?? '';
    const wordCount = articleMarkdown.split(/\s+/).filter(Boolean).length;

    // Update the brief piece to also store the article (type stays 'brief' for the record,
    // a separate article content piece is created)
    const insertedArticle = await this.db.db
      .insert(contentPieces)
      .values({
        projectId,
        topicalMapId: page.topicalMapId,
        topicalMapPageId: pageId,
        type: 'article',
        status: 'draft',
        title: page.title,
        articleData: { markdown: articleMarkdown },
        wordCount,
      })
      .onConflictDoNothing()
      .returning();

    // If a concurrent request already inserted an article, fetch it
    const articlePiece = insertedArticle[0] ?? await this.db.db.query.contentPieces.findFirst({
      where: (cp, { and: a, eq: e }) => a(e(cp.topicalMapPageId, pageId), e(cp.type, 'article')),
    });
    if (!articlePiece) throw new Error(`Failed to create or find article for page ${pageId}`);

    // Deduct credits only when a new article was actually created
    if (insertedArticle[0]) {
      await this.creditsService.debit({
        organizationId,
        amount: CREDIT_COSTS.article,
        description: `Article generated for page: ${page.title}`,
      }).catch((e: unknown) =>
        this.logger.error(`Credit debit failed for article ${articlePiece.id}: ${e}`),
      );
    }

    this.logger.log(`Article created: ${articlePiece.id} for page ${pageId}`);
    return articlePiece;
  }
}
