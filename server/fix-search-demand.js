/**
 * fix-search-demand.js
 * Reconstructs search-demand output from existing seed-keywords context data
 * (which already has volume + difficulty per keyword from Ahrefs).
 * DataForSEO returned 402; Ahrefs data is sufficient for this step.
 *
 *   node fix-search-demand.js
 */
const { Client } = require('pg');

const RUN_ID = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';

// Mirror the opportunityScore formula from search-demand.pipeline.ts
function calcOpportunityScore(volume, difficulty) {
  if (volume <= 0) return 0;
  return parseFloat(
    ((Math.min(volume, 10000) / 10000) * 0.4 + ((100 - difficulty) / 100) * 0.4 + 0.5 * 0.2).toFixed(3)
  );
}

const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });

c.connect().then(async () => {
  // Load seed-keywords context
  const skRow = await c.query(
    "SELECT value FROM workflow_context WHERE workflow_run_id = $1 AND key = 'seed-keywords'",
    [RUN_ID]
  );
  if (!skRow.rows.length) {
    console.log('ERROR: seed-keywords context not found');
    await c.end();
    return;
  }
  const seedCtx = skRow.rows[0].value;
  const seedKeywords = seedCtx.seedKeywords || [];

  console.log(`Building search-demand from ${seedKeywords.length} seed keywords...`);

  // Build enrichedKeywords matching pipeline schema
  const enrichedKeywords = seedKeywords.map(sk => ({
    keyword: sk.keyword,
    category: sk.category || 'general',
    intent: sk.intent || 'informational',
    metrics: {
      searchVolume: sk.volume || 0,
      keywordDifficulty: sk.difficulty || 0,
      cpc: 0,
      competition: (sk.difficulty || 0) > 60 ? 'high' : (sk.difficulty || 0) > 30 ? 'medium' : 'low',
      trend: 'stable',
    },
    opportunityScore: calcOpportunityScore(sk.volume || 0, sk.difficulty || 0),
  }));

  const totalAddressableVolume = enrichedKeywords.reduce((s, k) => s + k.metrics.searchVolume, 0);
  const withVolume = enrichedKeywords.filter(k => k.metrics.searchVolume > 0);
  const realisticTargetVolume = Math.round(totalAddressableVolume * 0.1);

  const highOpportunity = enrichedKeywords
    .filter(k => k.opportunityScore > 0.6)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 20)
    .map(k => ({
      keyword: k.keyword,
      volume: k.metrics.searchVolume,
      difficulty: k.metrics.keywordDifficulty,
      opportunityScore: k.opportunityScore,
      rationale: `Volume: ${k.metrics.searchVolume}, KD: ${k.metrics.keywordDifficulty}`,
    }));

  // Aggregate demand by category (using real categories from seed-keywords)
  const categoryMap = {};
  for (const k of enrichedKeywords) {
    const cat = k.category;
    if (!categoryMap[cat]) categoryMap[cat] = { category: cat, totalVolume: 0, difficultySum: 0, keywordCount: 0, topKeyword: null, topVolume: 0 };
    categoryMap[cat].totalVolume += k.metrics.searchVolume;
    categoryMap[cat].difficultySum += k.metrics.keywordDifficulty;
    categoryMap[cat].keywordCount += 1;
    if (k.metrics.searchVolume > categoryMap[cat].topVolume) {
      categoryMap[cat].topVolume = k.metrics.searchVolume;
      categoryMap[cat].topKeyword = k.keyword;
    }
  }
  const demandByCategory = Object.values(categoryMap).map(c => ({
    category: c.category,
    totalVolume: c.totalVolume,
    avgDifficulty: c.keywordCount > 0 ? Math.round(c.difficultySum / c.keywordCount) : 0,
    keywordCount: c.keywordCount,
    topKeyword: c.topKeyword || '',
  }));

  // Demand by intent
  const intentMap = {};
  for (const k of enrichedKeywords) {
    const intent = k.intent;
    if (!intentMap[intent]) intentMap[intent] = { volume: 0, count: 0, difficultySum: 0 };
    intentMap[intent].volume += k.metrics.searchVolume;
    intentMap[intent].count += 1;
    intentMap[intent].difficultySum += k.metrics.keywordDifficulty;
  }
  const demandByIntent = {
    informational:  intentMap.informational  ? { volume: intentMap.informational.volume,  count: intentMap.informational.count,  avgDifficulty: Math.round(intentMap.informational.difficultySum / intentMap.informational.count)   } : { volume: 0, count: 0, avgDifficulty: 0 },
    navigational:   intentMap.navigational   ? { volume: intentMap.navigational.volume,   count: intentMap.navigational.count,   avgDifficulty: Math.round(intentMap.navigational.difficultySum / intentMap.navigational.count)     } : { volume: 0, count: 0, avgDifficulty: 0 },
    commercial:     intentMap.commercial     ? { volume: intentMap.commercial.volume,     count: intentMap.commercial.count,     avgDifficulty: Math.round(intentMap.commercial.difficultySum / intentMap.commercial.count)         } : { volume: 0, count: 0, avgDifficulty: 0 },
    transactional:  intentMap.transactional  ? { volume: intentMap.transactional.volume,  count: intentMap.transactional.count,  avgDifficulty: Math.round(intentMap.transactional.difficultySum / intentMap.transactional.count)   } : { volume: 0, count: 0, avgDifficulty: 0 },
  };

  const output = {
    enrichedKeywords,
    demandByCategory,
    demandByIntent,
    highOpportunity,
    totalAddressableVolume,
    realisticTargetVolume,
    summary: `Analysed ${enrichedKeywords.length} keywords (source: Ahrefs seed data; DataForSEO unavailable — 402). Total addressable volume: ${totalAddressableVolume.toLocaleString()}. ${withVolume.length} keywords have volume data. High-opportunity keywords: ${highOpportunity.length}. Top opportunity: ${highOpportunity[0]?.keyword ?? 'n/a'} (score: ${highOpportunity[0]?.opportunityScore ?? 0}).`,
  };

  console.log(`enrichedKeywords: ${output.enrichedKeywords.length}`);
  console.log(`totalAddressableVolume: ${output.totalAddressableVolume}`);
  console.log(`highOpportunity: ${output.highOpportunity.length}`);

  // Check if context already exists
  const existing = await c.query(
    "SELECT jsonb_typeof(value) AS jt FROM workflow_context WHERE workflow_run_id = $1 AND key = 'search-demand'",
    [RUN_ID]
  );

  if (existing.rows.length && existing.rows[0].jt === 'object') {
    console.log('search-demand context already an object — nothing to update.');
  } else if (existing.rows.length) {
    await c.query(
      "UPDATE workflow_context SET value = $1::jsonb WHERE workflow_run_id = $2 AND key = 'search-demand'",
      [JSON.stringify(output), RUN_ID]
    );
    console.log('Updated workflow_context for search-demand');
  } else {
    await c.query(
      "INSERT INTO workflow_context (workflow_run_id, key, value) VALUES ($1, 'search-demand', $2::jsonb)",
      [RUN_ID, JSON.stringify(output)]
    );
    console.log('Inserted workflow_context for search-demand');
  }

  // Mark step as completed
  await c.query(
    "UPDATE workflow_steps SET status = 'completed', completed_at = NOW(), updated_at = NOW(), error = NULL WHERE workflow_run_id = $1 AND step_key = 'search-demand'",
    [RUN_ID]
  );
  console.log('Marked search-demand as completed');

  // Insert step artifact
  const stepRow = await c.query(
    "SELECT id FROM workflow_steps WHERE workflow_run_id = $1 AND step_key = 'search-demand'",
    [RUN_ID]
  );
  if (stepRow.rows.length) {
    const stepId = stepRow.rows[0].id;
    // Check if artifact exists
    const artExists = await c.query(
      "SELECT id FROM step_artifacts WHERE workflow_step_id = $1",
      [stepId]
    );
    if (!artExists.rows.length) {
      await c.query(
        "INSERT INTO step_artifacts (id, workflow_step_id, workflow_run_id, step_key, version, data, reasoning, metadata) VALUES (gen_random_uuid(), $1, $2, 'search-demand', 1, $3::jsonb, 'Reconstructed from seed-keywords Ahrefs data (DataForSEO 402 unavailable)', $4::jsonb)",
        [stepId, RUN_ID, JSON.stringify(output), JSON.stringify({ provider: 'ahrefs', model: 'pipeline', tokensUsed: 0, iterations: 0 })]
      );
      console.log('Inserted step artifact');
    } else {
      console.log('Artifact already exists — not inserting duplicate');
    }
  }

  console.log('\nDone. Run enqueue-pending.js to advance the workflow.');
  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
