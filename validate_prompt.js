const { PromptService } = require('./dist/shared/prompt/prompt.service');
const path = require('path');

async function main() {
  try {
    const config = { get: () => undefined };
    const service = new PromptService(config);

    const promptPath = 'discovery/seed-keywords.prompt.md';
    const agentKey = 'seed-keywords';

    const prompt = await service.loadPrompt(promptPath);
    const agent = await service.loadAgentDefinition(agentKey);

    const fullPromptText = prompt.system + '\n' + prompt.user;

    const result = {
      executionType: agent.executionType,
      toolsLength: agent.tools ? agent.tools.length : 0,
      promptMentionsNoLiveTools: /no live tools/i.test(fullPromptText),
      promptMentionsPipelineDataOnly: /pipeline data only/i.test(fullPromptText),
      promptTopLevelSchemaKeysPresent: [
        'seedKeywords',
        'categories',
        'totalCount',
        'coverageNotes'
      ].every(key => fullPromptText.includes(key))
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
