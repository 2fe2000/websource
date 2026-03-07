import { input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import type { ConversationState } from '../../../shared/types.js';
import { DEFAULTS } from '../../../config/defaults.js';
import * as sourceRepo from '../../../persistence/repositories/source-repo.js';
import * as configRepo from '../../../persistence/repositories/config-repo.js';
import * as scheduleRepo from '../../../persistence/repositories/schedule-repo.js';
import type { StepHandler } from '../conversation.js';

export const confirmStep: StepHandler = {
  async enter(state) {
    // Suggest a source name
    const suggestedName = state.analysis?.title
      ? state.analysis.title.slice(0, 50)
      : new URL(state.url!).hostname;

    const name = await input({
      message: 'Name for this source:',
      default: suggestedName,
    });
    state.sourceName = name;

    // Show summary
    console.log('');
    console.log(chalk.bold.blue('Source Configuration Summary'));
    console.log(chalk.dim('─'.repeat(50)));
    console.log(`  Name:       ${chalk.cyan(name)}`);
    console.log(`  URL:        ${chalk.cyan(state.url!)}`);
    console.log(`  Fetch Mode: ${state.fetchMode ?? 'static'}`);
    console.log(`  Fields:     ${state.selectedFields?.map((f) => f.name).join(', ') ?? 'none'}`);
    console.log(`  Selector:   ${state.selectedBlock?.selector ?? 'none'}`);
    console.log(`  Schedule:   ${state.schedule ? `${state.schedule.preset} (${state.schedule.cronExpr})` : 'manual'}`);
    if (state.detailPageConfig) {
      console.log(`  Detail:     ${chalk.green('Enabled')} — ${state.detailPageConfig.linkSelector}`);
    }
    console.log(chalk.dim('─'.repeat(50)));
    console.log('');

    const doSave = await confirm({ message: 'Save this source?', default: true });

    if (!doSave) {
      console.log(chalk.yellow('Cancelled. Nothing was saved.'));
      state.step = 'done';
      return state;
    }

    // Persist
    const source = sourceRepo.createSource({
      name,
      url: state.url!,
      description: `Auto-configured from ${state.analysis?.pageType ?? 'unknown'} page`,
    });

    const config = configRepo.createConfig({
      sourceId: source.id,
      version: 1,
      fetchMode: state.fetchMode ?? 'static',
      listSelector: state.selectedBlock?.selector ?? 'body',
      fields: state.selectedFields ?? [],
      pagination: state.analysis?.paginationHints[0]
        ? {
            strategy: state.analysis.paginationHints[0].strategy,
            nextSelector: state.analysis.paginationHints[0].selector,
            maxPages: DEFAULTS.maxPages,
          }
        : undefined,
      detailPage: state.detailPageConfig,
      rateLimitMs: DEFAULTS.rateLimitMs,
      timeoutMs: DEFAULTS.timeoutMs,
      maxRetries: DEFAULTS.maxRetries,
      robotsPolicy: DEFAULTS.robotsPolicy,
      isActive: true,
    });

    if (state.schedule) {
      scheduleRepo.upsertSchedule({
        sourceId: source.id,
        cronExpr: state.schedule.cronExpr,
        preset: state.schedule.preset,
      });
    }

    console.log('');
    console.log(chalk.green.bold('Source saved!'));
    console.log(`  ID:     ${chalk.cyan(source.id)}`);
    console.log(`  Config: ${chalk.cyan(config.id)}`);
    console.log('');
    console.log(chalk.dim('Next steps:'));
    console.log(chalk.dim(`  websource preview ${source.id}   — Preview extraction`));
    console.log(chalk.dim(`  websource extract ${source.id}   — Run extraction`));
    console.log(chalk.dim(`  websource sources show ${source.id} — View source details`));
    console.log('');

    state.step = 'done';
    return state;
  },
};
