'use server';

import { readFile } from 'fs/promises';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { join } from 'path';
import {
  approveKeywordWorkflowCheckpoint,
  createKeywordWorkflowArtifact,
  createKeywordWorkflowCompetitor,
  createKeywordWorkflowContentGapImport,
  getKeywordWorkflow,
  rejectKeywordWorkflowCheckpoint,
  requestKeywordWorkflowRevision,
  upsertKeywordWorkflowCompetitorMetrics,
} from '@/features/keywords/services/keywords.service';
import {
  type Method02SourceKeyword,
  buildConsolidatedKeywordsPayload,
  buildTopicalMapPayload,
  buildMethod01AutoFindings,
  buildMethod01AutoEvidence,
  buildMethod02ParentTopicCandidates,
  buildMethod02AutoFindings,
  buildMethod02AutoEvidence,
  mergeMethod02ParentTopicCandidates,
  mergeTopPageCandidates,
  getStoredTopPageCandidates,
  getSeedKeywordStepSource,
  getSeedKeywordDraftValues,
  getContentBriefQueue,
  getContentBriefSource,
  buildContentBriefTitleOptions,
  buildContentBriefOutline,
  buildContentArticleSectionPlan,
  buildContentArticleDraftChecklist,
  extractBusinessProfileSeedKeywordsFromFindings,
  readBusinessProfileSeedKeywords,
  sanitizeGeneratedBusinessProfileDraft,
  buildBusinessProfileKeyFindings,
  parsePhase1WinningUrls,
  parseCompetitorTopPages,
  parseMetricValue,
  parseMethod02Clusters,
  toLines,
  getWorkflowPath,
} from './workflow-utils';

// ===== SERVER-ONLY HELPERS =====

async function readWorkspaceEnvValue(key: string) {
  const envPaths = [
    join(process.cwd(), '.env.local'),
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '.env.local'),
    join(process.cwd(), '..', '.env'),
  ];
  for (const envPath of envPaths) {
    try {
      const fileContents = await readFile(envPath, 'utf8');
      const match = fileContents.match(new RegExp(`^${key}=(.*)$`, 'm'));
      if (!match) continue;
      return match[1].trim().replace(/^['\"]|['\"]$/g, '');
    } catch {
      continue;
    }
  }
  return null;
}

function htmlToTextLight(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWebsiteText(websiteUrl: string) {
  const response = await fetch(websiteUrl, {
    cache: 'no-store',
    headers: { 'User-Agent': 'PulseKeywordWorkflow/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Website fetch failed with status ${response.status}.`);
  }
  const html = await response.text();
  return htmlToTextLight(html).slice(0, 12000);
}

async function persistArtifactFromFormData(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const stepKey = String(formData.get('stepKey') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim();
  const headline = String(formData.get('headline') ?? '').trim();
  const keyFindings = String(formData.get('keyFindings') ?? '').trim();
  const recommendedAction = String(formData.get('recommendedAction') ?? '').trim();
  const evidence = String(formData.get('evidence') ?? '').trim();
  const openQuestions = String(formData.get('openQuestions') ?? '').trim();
  const contentGapImport = String(formData.get('contentGapImport') ?? '').trim();
  const baselineWinningUrls = String(formData.get('baselineWinningUrls') ?? '').trim();
  const baselineCoreTopics = String(formData.get('baselineCoreTopics') ?? '').trim();
  const baselineExistingKeywords = String(formData.get('baselineExistingKeywords') ?? '').trim();
  const baselinePriorityVerticals = String(formData.get('baselinePriorityVerticals') ?? '').trim();
  const phase1Baseline =
    stepKey === 'phase1-baseline'
      ? {
          winningUrls: parsePhase1WinningUrls(baselineWinningUrls),
          coreTopics: toLines(baselineCoreTopics),
          existingKeywords: toLines(baselineExistingKeywords),
          priorityVerticals: toLines(baselinePriorityVerticals),
        }
      : null;

  if (!projectId || !workflowId || !stepKey || !keyFindings) {
    throw new Error('Project, workflow, step, and artifact findings are required.');
  }

  if (
    stepKey === 'phase1-baseline' &&
    phase1Baseline &&
    phase1Baseline.winningUrls.length === 0 &&
    phase1Baseline.existingKeywords.length === 0
  ) {
    throw new Error('Phase 1 baseline requires existing winning URLs or existing keywords to deduplicate.');
  }

  const contentGapImportRecord =
    stepKey === 'method03-content-gap-import'
      ? await createKeywordWorkflowContentGapImport(projectId, workflowId, {
          rawImport: contentGapImport,
          notes: evidence || summary || undefined,
        })
      : null;

  const summaryPayload =
    summary || contentGapImportRecord || phase1Baseline
      ? {
          ...(summary ? { note: summary } : {}),
          ...(contentGapImportRecord
            ? {
                importedRows: contentGapImportRecord.rowCount,
                contentGapImportId: contentGapImportRecord.id,
              }
            : {}),
          ...(phase1Baseline
            ? {
                trackedUrls: phase1Baseline.winningUrls.length,
                existingKeywordCount: phase1Baseline.existingKeywords.length,
              }
            : {}),
        }
      : undefined;

  const payload: Record<string, unknown> = {
    headline: headline || null,
    keyFindings: toLines(keyFindings),
    recommendedAction: recommendedAction || null,
    evidence: toLines(evidence),
    openQuestions: toLines(openQuestions),
  };

  if (contentGapImportRecord) {
    payload.contentGapImport = {
      id: contentGapImportRecord.id,
      format: contentGapImportRecord.format,
      headers: contentGapImportRecord.headers,
      rowCount: contentGapImportRecord.rowCount,
      createdAt: contentGapImportRecord.createdAt,
    };
  }

  if (phase1Baseline) {
    payload.phase1Baseline = phase1Baseline;
  }

  if (stepKey === 'business-profile') {
    const workflow = await getKeywordWorkflow(projectId, workflowId);
    const latestBusinessProfileArtifact = (workflow.artifacts ?? []).find((artifact) => artifact.stepKey === 'business-profile');
    const seedKeywords = extractBusinessProfileSeedKeywordsFromFindings(toLines(keyFindings));
    const persistedSeedKeywords = seedKeywords.length > 0 ? seedKeywords : readBusinessProfileSeedKeywords(latestBusinessProfileArtifact);
    if (persistedSeedKeywords.length > 0) {
      payload.seedKeywords = persistedSeedKeywords;
    }
  }

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey,
    summary: summaryPayload,
    payload,
  });

  return { projectId, workflowId, stepKey };
}

// ===== SERVER ACTIONS =====

export async function approveArtifactAction(formData: FormData) {
  const { projectId, workflowId, stepKey } = await persistArtifactFromFormData(formData);
  await approveKeywordWorkflowCheckpoint(projectId, workflowId, stepKey);
  const workflowPath = getWorkflowPath(projectId, workflowId);
  revalidatePath(workflowPath);
  redirect(workflowPath);
}

export async function generateBusinessProfileDraftAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const stepKey = String(formData.get('stepKey') ?? '').trim();
  const websiteUrl = String(formData.get('websiteUrl') ?? '').trim();
  const businessProfileContext = String(formData.get('businessProfileContext') ?? '').trim();

  if (!projectId || !workflowId || !websiteUrl) {
    throw new Error('Project, workflow, and website URL are required to generate the business profile.');
  }

  if (stepKey !== 'business-profile') {
    throw new Error('Business profile generation is only available for the business-profile step.');
  }

  const openAiApiKey = process.env.OPENAI_API_KEY || (await readWorkspaceEnvValue('OPENAI_API_KEY'));

  if (!openAiApiKey) {
    throw new Error('OPENAI_API_KEY is not configured for business profile generation.');
  }

  let websiteText = '';
  let sourceEvidence = '';

  try {
    websiteText = await fetchWebsiteText(websiteUrl);
    sourceEvidence = `Fetched homepage content automatically from ${websiteUrl}.`;
  } catch (error) {
    if (!businessProfileContext) {
      throw new Error(
        error instanceof Error
          ? `${error.message} Paste homepage or service-page content and try again.`
          : 'Could not fetch website content automatically. Paste homepage or service-page content and try again.',
      );
    }
    sourceEvidence = `Automatic website fetch failed for ${websiteUrl}; generation used strategist-provided source content instead.`;
  }

  const sourceText = [websiteText, businessProfileContext]
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n\n---\n\n');

  if (!sourceText) {
    throw new Error('Provide source content before generating the business profile draft.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.4',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a senior SEO strategist producing a Step 01 business-profile draft for an internal keyword workflow. Use only the supplied source content. Be concise, evidence-based, and return valid JSON only.',
        },
        {
          role: 'user',
          content: [
            `Website URL: ${websiteUrl}`,
            'Analyze the business and return a structured draft with these exact keys:',
            '{',
            '  "summary": "one-sentence business summary",',
            '  "headline": "core positioning statement",',
            '  "brandIdentity": "brand identity and differentiation",',
            '  "toneOfVoice": "tone and communication style",',
            '  "targetMarket": "who they sell to",',
            '  "operationalModel": "how they work or deliver",',
            '  "services": ["specific services or product lines"],',
            '  "geography": "geographic focus",',
            '  "seedKeywords": ["10 to 15 seed keywords grounded in the source content"],',
            '  "recommendedAction": "what the strategist should review next",',
            '  "openQuestions": ["open questions that need manual confirmation"]',
            '}',
            'Source content:',
            sourceText.slice(0, 16000),
          ].join('\n'),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI business profile generation failed with status ${response.status}.`);
  }

  const responsePayload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const rawDraft = responsePayload.choices?.[0]?.message?.content;

  if (!rawDraft) {
    throw new Error('OpenAI returned an empty business profile draft.');
  }

  const generatedDraft = sanitizeGeneratedBusinessProfileDraft(JSON.parse(rawDraft) as Record<string, unknown>);
  const generatedFindings = buildBusinessProfileKeyFindings(generatedDraft);

  if (generatedFindings.length === 0) {
    throw new Error('OpenAI did not return enough structured detail to create the business profile draft.');
  }

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'business-profile',
    summary: {
      note: generatedDraft.summary || `AI-generated business profile draft for ${websiteUrl}.`,
      websiteUrl,
      source: 'openai-draft',
    },
    payload: {
      headline: generatedDraft.headline || generatedDraft.brandIdentity || null,
      seedKeywords: generatedDraft.seedKeywords,
      keyFindings: generatedFindings,
      recommendedAction:
        generatedDraft.recommendedAction ||
        'Review the generated business profile, adjust the seed keywords, and approve it before moving to seed confirmation.',
      evidence: [
        sourceEvidence,
        ...(businessProfileContext ? ['Included additional strategist-provided source content in the prompt.'] : []),
      ],
      openQuestions: generatedDraft.openQuestions,
      generatedProfile: {
        brandIdentity: generatedDraft.brandIdentity,
        toneOfVoice: generatedDraft.toneOfVoice,
        targetMarket: generatedDraft.targetMarket,
        operationalModel: generatedDraft.operationalModel,
        services: generatedDraft.services,
        geography: generatedDraft.geography,
        seedKeywords: generatedDraft.seedKeywords,
      },
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

export async function generateSeedKeywordsDraftAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const stepKey = String(formData.get('stepKey') ?? '').trim();

  if (!projectId || !workflowId) {
    throw new Error('Project and workflow are required to generate Step 2 seed keywords.');
  }

  if (stepKey !== 'seed-keywords') {
    throw new Error('Seed keyword generation is only available for the seed-keywords step.');
  }

  const workflow = await getKeywordWorkflow(projectId, workflowId);
  const businessProfileArtifacts = (workflow.artifacts ?? []).filter((artifact) => artifact.stepKey === 'business-profile');
  const source = getSeedKeywordStepSource(businessProfileArtifacts);
  const draftValues = getSeedKeywordDraftValues(source);

  if (!source || !draftValues) {
    throw new Error('Generate or approve the business-profile step first so Step 2 can load the seed keywords for confirmation.');
  }

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'seed-keywords',
    summary: {
      note: draftValues.summary,
      sourceArtifactId: source.sourceArtifactId,
      sourceStep: 'business-profile',
    },
    payload: {
      headline: draftValues.headline,
      keyFindings: toLines(draftValues.keyFindings),
      recommendedAction: draftValues.recommendedAction,
      evidence: toLines(draftValues.evidence),
      openQuestions: toLines(draftValues.openQuestions),
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

export async function createMethod01ArtifactAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim();
  const keyFindings = String(formData.get('keyFindings') ?? '').trim();
  const topPageCandidates = String(formData.get('topPageCandidates') ?? '').trim();
  const recommendedAction = String(formData.get('recommendedAction') ?? '').trim();
  const evidence = String(formData.get('evidence') ?? '').trim();
  const openQuestions = String(formData.get('openQuestions') ?? '').trim();
  const selectedCompetitors = formData
    .getAll('sourceCompetitor')
    .map((entry) => JSON.parse(String(entry)) as Record<string, unknown>);

  if (!projectId || !workflowId) throw new Error('Project and workflow are required to generate Method 01.');
  if (selectedCompetitors.length === 0) throw new Error('Select at least one approved direct competitor for Method 01.');

  const automatedTopPageCandidates = getStoredTopPageCandidates(selectedCompetitors);

  if (automatedTopPageCandidates.length === 0) {
    throw new Error('Selected competitors need stored top pages before Method 01 can be generated.');
  }

  const mergedTopPageCandidates = mergeTopPageCandidates(
    automatedTopPageCandidates,
    parseCompetitorTopPages(topPageCandidates),
  );
  const automatedFindings = buildMethod01AutoFindings(selectedCompetitors, mergedTopPageCandidates);
  const combinedEvidence = [...buildMethod01AutoEvidence(selectedCompetitors), ...toLines(evidence)];

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'method01-competitor-pages',
    summary: {
      note:
        summary ||
        `Auto-generated from ${selectedCompetitors.length} approved direct competitors and ${mergedTopPageCandidates.length} stored top pages.`,
      sourceCompetitorCount: selectedCompetitors.length,
    },
    payload: {
      headline: 'Approved direct competitor source set',
      sourceCompetitors: selectedCompetitors,
      keyFindings: [...automatedFindings, ...toLines(keyFindings)],
      topPageCandidates: mergedTopPageCandidates,
      recommendedAction:
        recommendedAction || 'Review the strongest competitor-page themes and promote the approved patterns into consolidation.',
      evidence: combinedEvidence,
      openQuestions: toLines(openQuestions),
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

export async function createMethod02ArtifactAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim();
  const keyFindings = String(formData.get('keyFindings') ?? '').trim();
  const parentTopicCandidates = String(formData.get('parentTopicCandidates') ?? '').trim();
  const questionKeywords = String(formData.get('questionKeywords') ?? '').trim();
  const recommendedAction = String(formData.get('recommendedAction') ?? '').trim();
  const evidence = String(formData.get('evidence') ?? '').trim();
  const openQuestions = String(formData.get('openQuestions') ?? '').trim();
  const selectedSeedKeywords = formData
    .getAll('sourceSeedKeyword')
    .map((entry) => JSON.parse(String(entry)) as Method02SourceKeyword)
    .filter((entry) => entry.keyword.trim().length > 0);

  if (!projectId || !workflowId) throw new Error('Project and workflow are required to generate Method 02.');
  if (selectedSeedKeywords.length === 0) throw new Error('Select at least one source keyword for Method 02.');

  const automatedParentTopicCandidates = buildMethod02ParentTopicCandidates(selectedSeedKeywords);
  const mergedParentTopicCandidates = mergeMethod02ParentTopicCandidates(
    automatedParentTopicCandidates,
    parseMethod02Clusters(parentTopicCandidates),
  );
  const automatedFindings = buildMethod02AutoFindings(selectedSeedKeywords, mergedParentTopicCandidates);
  const combinedEvidence = [...buildMethod02AutoEvidence(selectedSeedKeywords), ...toLines(evidence)];

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'method02-seed-expansion',
    summary: {
      note:
        summary ||
        `Auto-generated from ${selectedSeedKeywords.length} source keywords and ${mergedParentTopicCandidates.length} parent topic candidates.`,
      sourceSeedKeywordCount: selectedSeedKeywords.length,
    },
    payload: {
      headline: 'Approved seed keyword source set',
      sourceSeedKeywords: selectedSeedKeywords.map((keyword) => keyword.keyword),
      keyFindings: [...automatedFindings, ...toLines(keyFindings)],
      parentTopicCandidates: mergedParentTopicCandidates,
      questionKeywords: toLines(questionKeywords),
      recommendedAction:
        recommendedAction || 'Review the strongest parent topic groupings and merge the approved clusters into consolidation.',
      evidence: combinedEvidence,
      openQuestions: toLines(openQuestions),
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

export async function createConsolidatedKeywordsArtifactAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const sourceArtifacts = formData
    .getAll('sourceArtifact')
    .map((entry) => JSON.parse(String(entry)) as Record<string, unknown>);

  if (!projectId || !workflowId) throw new Error('Project and workflow are required to generate consolidated keywords.');
  if (sourceArtifacts.length === 0) throw new Error('Approve at least one workflow source before generating consolidated keywords.');

  const { consolidatedKeywords, duplicateExistingKeywords } = buildConsolidatedKeywordsPayload(sourceArtifacts);

  if (consolidatedKeywords.length === 0) {
    throw new Error('No consolidatable keywords were found in the approved workflow sources.');
  }

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'consolidated-keywords',
    summary: {
      note: `Auto-generated consolidated ledger with ${consolidatedKeywords.length} kept keywords from ${sourceArtifacts.length} approved workflow checkpoints.`,
      sourceArtifactCount: sourceArtifacts.length,
      keptKeywordCount: consolidatedKeywords.length,
      duplicateExistingKeywordCount: duplicateExistingKeywords.length,
    },
    payload: {
      headline: 'Consolidated keyword ledger',
      consolidatedKeywords,
      duplicateExistingKeywords,
      sourceArtifacts: sourceArtifacts.map((artifact) => ({
        id: artifact.id,
        stepKey: artifact.stepKey,
      })),
      recommendedAction: 'Review the kept keyword ledger and approve it before topical map generation.',
      evidence: sourceArtifacts.map((artifact) => {
        const stepKey = typeof artifact.stepKey === 'string' ? artifact.stepKey : 'unknown-step';
        return `${stepKey} | Approved checkpoint`;
      }),
      openQuestions: [],
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

export async function createTopicalMapArtifactAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const sourceArtifact = JSON.parse(String(formData.get('sourceArtifact') ?? '{}')) as Record<string, unknown>;

  if (!projectId || !workflowId) throw new Error('Project and workflow are required to generate the topical map.');

  const { primaryTopics, contentBriefQueue, rolloutPriorities } = buildTopicalMapPayload(sourceArtifact);

  if (primaryTopics.length === 0 || contentBriefQueue.length === 0) {
    throw new Error('Approve a consolidated keyword ledger with kept keywords before generating the topical map.');
  }

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'topical-map',
    summary: {
      note: `Auto-generated topical map with ${primaryTopics.length} pillars and ${contentBriefQueue.length} mapped keywords from the approved consolidated ledger.`,
      pillarCount: primaryTopics.length,
      mappedKeywordCount: contentBriefQueue.length,
      sourceArtifactId: typeof sourceArtifact.id === 'string' ? sourceArtifact.id : null,
    },
    payload: {
      headline: 'Workflow topical map draft',
      primaryTopics,
      contentBriefQueue,
      rolloutPriorities,
      sourceArtifacts: [{ id: sourceArtifact.id, stepKey: sourceArtifact.stepKey }],
      recommendedAction: 'Review the pillar and cluster structure, then approve the topical map before generating content briefs.',
      evidence: [
        `${typeof sourceArtifact.stepKey === 'string' ? sourceArtifact.stepKey : 'unknown-step'} | Approved checkpoint`,
      ],
      openQuestions: [],
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

export async function createContentBriefArtifactAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const language = String(formData.get('language') ?? 'en').trim();
  const country = String(formData.get('country') ?? '').trim().toLowerCase();
  const editorialNotes = String(formData.get('editorialNotes') ?? '').trim();
  const selectedQueueKey = String(formData.get('selectedQueueKey') ?? '').trim();
  const sourceArtifact = JSON.parse(String(formData.get('sourceArtifact') ?? '{}')) as Record<string, unknown>;
  const queueEntry = getContentBriefQueue(sourceArtifact).find(
    (entry) => `${entry.pillar}::${entry.keyword}` === selectedQueueKey,
  );

  if (!queueEntry) throw new Error('Select an approved topical-map queue entry before generating a content brief checkpoint.');

  const keyword = typeof queueEntry.keyword === 'string' ? queueEntry.keyword.trim() : '';
  const pillar = typeof queueEntry.pillar === 'string' ? queueEntry.pillar.trim() : '';
  const contentType = queueEntry.contentType === 'pillar' ? 'pillar' : ('cluster' as const);
  const suggestedUrlPath =
    typeof queueEntry.suggestedUrlPath === 'string' && queueEntry.suggestedUrlPath.trim().length > 0
      ? queueEntry.suggestedUrlPath.trim()
      : null;
  const sourceMethods = Array.isArray(queueEntry.sourceMethods)
    ? queueEntry.sourceMethods.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const sourceArtifactIds = Array.isArray(queueEntry.sourceArtifactIds)
    ? queueEntry.sourceArtifactIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const existingCoverageUrl =
    typeof queueEntry.existingCoverageUrl === 'string' && queueEntry.existingCoverageUrl.trim().length > 0
      ? queueEntry.existingCoverageUrl.trim()
      : null;

  if (!projectId || !workflowId || !keyword || !pillar || !country) {
    throw new Error('Project, workflow, market, and content brief target are required.');
  }

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'content-brief',
    summary: {
      note: `Auto-generated content brief input for ${keyword} from the approved topical map.`,
      targetKeyword: keyword,
      sourceArtifactId: typeof sourceArtifact.id === 'string' ? sourceArtifact.id : null,
    },
    payload: {
      headline: `Content brief input for ${keyword}`,
      targetKeyword: keyword,
      pillar,
      contentType,
      suggestedUrlPath,
      market: { language, country },
      titleOptions: buildContentBriefTitleOptions(keyword, pillar, country, contentType),
      briefOutline: buildContentBriefOutline(keyword, pillar, contentType),
      researchContext: {
        sourceMethods,
        sourceArtifactIds: Array.from(
          new Set([...sourceArtifactIds, ...(typeof sourceArtifact.id === 'string' ? [sourceArtifact.id] : [])]),
        ),
        existingCoverageUrl,
      },
      internalLinkTargets: Array.from(
        new Set([suggestedUrlPath, existingCoverageUrl].filter((value): value is string => Boolean(value))),
      ),
      editorialNotes: toLines(editorialNotes),
      sourceArtifacts: [{ id: sourceArtifact.id, stepKey: sourceArtifact.stepKey }],
      recommendedAction: 'Review the brief inputs and approve them before article generation.',
      evidence: [
        `${typeof sourceArtifact.stepKey === 'string' ? sourceArtifact.stepKey : 'unknown-step'} | Approved checkpoint`,
        `${keyword} | ${contentType} | ${suggestedUrlPath ?? 'no suggested URL'}`,
      ],
      openQuestions: [],
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

export async function createContentArticleArtifactAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const selectedTitle = String(formData.get('selectedTitle') ?? '').trim();
  const articleNotes = String(formData.get('articleNotes') ?? '').trim();
  const sourceArtifact = JSON.parse(String(formData.get('sourceArtifact') ?? '{}')) as Record<string, unknown>;
  const briefSource = getContentBriefSource(sourceArtifact);

  if (!projectId || !workflowId || !briefSource) {
    throw new Error('Project, workflow, and approved content brief are required to generate the article input.');
  }

  const marketCountry = briefSource.market.country || 'ae';
  const titleOptions =
    briefSource.titleOptions.length > 0
      ? briefSource.titleOptions
      : buildContentBriefTitleOptions(
          briefSource.targetKeyword,
          briefSource.pillar,
          marketCountry,
          briefSource.contentType,
        );
  const resolvedTitle = titleOptions.includes(selectedTitle) ? selectedTitle : titleOptions[0];
  const articleSections = buildContentArticleSectionPlan(
    briefSource.targetKeyword,
    briefSource.pillar,
    briefSource.contentType,
    briefSource.briefOutline,
  );
  const draftChecklist = buildContentArticleDraftChecklist(
    briefSource.targetKeyword,
    briefSource.contentType,
    briefSource.suggestedUrlPath,
    briefSource.internalLinkTargets,
  );
  const combinedEditorialNotes = [...briefSource.editorialNotes, ...toLines(articleNotes)];

  await createKeywordWorkflowArtifact(projectId, workflowId, {
    stepKey: 'content-article',
    summary: {
      note: `Auto-generated article input for ${briefSource.targetKeyword} from the approved content brief.`,
      targetKeyword: briefSource.targetKeyword,
      sourceArtifactId: typeof sourceArtifact.id === 'string' ? sourceArtifact.id : null,
    },
    payload: {
      headline: `Content article input for ${briefSource.targetKeyword}`,
      targetKeyword: briefSource.targetKeyword,
      pillar: briefSource.pillar,
      contentType: briefSource.contentType,
      title: resolvedTitle,
      titleOptions,
      suggestedUrlPath: briefSource.suggestedUrlPath,
      market: briefSource.market,
      articleSections,
      draftChecklist,
      internalLinkTargets: briefSource.internalLinkTargets,
      researchContext: briefSource.researchContext,
      editorialNotes: combinedEditorialNotes,
      sourceArtifacts: [{ id: sourceArtifact.id, stepKey: sourceArtifact.stepKey }],
      recommendedAction:
        'Review the article input and approve it before handing the draft into queue-backed generation or persistence.',
      evidence: [
        `${typeof sourceArtifact.stepKey === 'string' ? sourceArtifact.stepKey : 'unknown-step'} | Approved checkpoint`,
        `${briefSource.targetKeyword} | ${resolvedTitle}`,
      ],
      openQuestions: [],
    },
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

export async function createCompetitorAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const domain = String(formData.get('domain') ?? '').trim();
  const bucket = String(formData.get('bucket') ?? 'UNCLASSIFIED').trim() as 'DIRECT' | 'ORGANIC' | 'UNCLASSIFIED';
  const status = String(formData.get('status') ?? 'APPROVED').trim() as 'CANDIDATE' | 'APPROVED' | 'REJECTED';
  const rationale = String(formData.get('rationale') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();

  if (!projectId || !workflowId || !domain) throw new Error('Project, workflow, and competitor domain are required.');

  await createKeywordWorkflowCompetitor(projectId, workflowId, {
    domain,
    bucket,
    status,
    rationale: rationale || undefined,
    notes: notes || undefined,
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

export async function saveCompetitorMetricsAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const competitorId = String(formData.get('competitorId') ?? '').trim();
  const topPages = String(formData.get('topPages') ?? '').trim();
  const capturedAt = String(formData.get('capturedAt') ?? '').trim();

  if (!projectId || !workflowId || !competitorId) {
    throw new Error('Project, workflow, and competitor are required to save metrics.');
  }

  await upsertKeywordWorkflowCompetitorMetrics(projectId, workflowId, competitorId, {
    domainRating: parseMetricValue(formData.get('domainRating'), 'Domain rating'),
    organicTraffic: parseMetricValue(formData.get('organicTraffic'), 'Organic traffic'),
    organicKeywords: parseMetricValue(formData.get('organicKeywords'), 'Organic keywords'),
    referringDomains: parseMetricValue(formData.get('referringDomains'), 'Referring domains'),
    backlinks: parseMetricValue(formData.get('backlinks'), 'Backlinks'),
    topPages: parseCompetitorTopPages(topPages),
    capturedAt: capturedAt || undefined,
  });

  revalidatePath(`/dashboard/keywords/${projectId}/workflows/${workflowId}`);
}

export async function reviewCheckpointAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '').trim();
  const workflowId = String(formData.get('workflowId') ?? '').trim();
  const stepKey = String(formData.get('stepKey') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  const decision = String(formData.get('decision') ?? '').trim();

  if (!projectId || !workflowId || !stepKey || !decision) {
    throw new Error('Project, workflow, step, and decision are required.');
  }

  if (decision === 'APPROVED') {
    await approveKeywordWorkflowCheckpoint(projectId, workflowId, stepKey, notes || undefined);
  } else if (decision === 'REVISION_REQUESTED') {
    await requestKeywordWorkflowRevision(projectId, workflowId, stepKey, notes || undefined);
  } else if (decision === 'REJECTED') {
    await rejectKeywordWorkflowCheckpoint(projectId, workflowId, stepKey, notes || undefined);
  } else {
    throw new Error('Unsupported checkpoint decision.');
  }

  const workflowPath = getWorkflowPath(projectId, workflowId);
  revalidatePath(workflowPath);

  if (decision === 'APPROVED') {
    redirect(workflowPath);
  }
}
