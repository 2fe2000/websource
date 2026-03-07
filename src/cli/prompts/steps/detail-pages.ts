import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import type { ConversationState } from '../../../shared/types.js';
import type { StepHandler } from '../conversation.js';

export const detailPagesStep: StepHandler = {
  canSkip(state) {
    return !state.analysis || state.analysis.detailLinkHints.length === 0;
  },

  async enter(state) {
    const hints = state.analysis!.detailLinkHints;
    const bestHint = hints[0];

    console.log(chalk.bold('Detail page links detected:'));
    console.log(`  Selector:   ${chalk.cyan(bestHint.selector)}`);
    console.log(`  Confidence: ${Math.round(bestHint.confidence * 100)}%`);
    console.log(`  Samples:`);
    for (const url of bestHint.sampleUrls.slice(0, 3)) {
      console.log(`    ${chalk.dim(url)}`);
    }
    console.log('');

    const followDetail = await confirm({
      message: 'Follow detail page links to extract additional fields?',
      default: false,
    });

    if (followDetail) {
      state.detailPageConfig = {
        linkSelector: bestHint.selector,
        linkAttribute: 'href',
        fields: [], // In v1, detail fields would be detected by analyzing a sample detail page
        fetchMode: state.fetchMode,
      };
      console.log(chalk.dim('Detail page traversal enabled. Fields will be extracted from detail pages.'));
    } else {
      console.log(chalk.dim('Skipping detail page traversal.'));
    }

    console.log('');
    return state;
  },
};
