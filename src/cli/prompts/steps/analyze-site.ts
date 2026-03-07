import chalk from 'chalk';
import type { ConversationState } from '../../../shared/types.js';
import { analyzeSite } from '../../../analysis/index.js';
import { formatBlocksTable, formatFieldsTable } from '../../formatters/table.js';
import type { StepHandler } from '../conversation.js';

export const analyzeStep: StepHandler = {
  async enter(state) {
    const url = state.url!;

    console.log('');
    console.log(chalk.bold.blue('Analyzing ') + chalk.underline(url) + chalk.bold.blue(' ...'));
    console.log('');

    const analysis = await analyzeSite(url);
    state.analysis = analysis;

    // Report what we found
    console.log(chalk.bold('Page Analysis'));
    console.log(`  Title:     ${chalk.cyan(analysis.title)}`);
    console.log(`  Type:      ${chalk.cyan(analysis.pageType)}`);
    console.log(`  Fetch:     ${analysis.fetchMode === 'rendered' ? chalk.yellow('Browser (JS-rendered)') : chalk.green('Static (fast)')}`);
    console.log(`  Robots:    ${analysis.robotsAllowed ? chalk.green('Allowed') : chalk.red('Blocked')}`);
    console.log(`  Time:      ${analysis.fetchTimeMs}ms`);
    console.log('');

    if (!analysis.robotsAllowed) {
      console.log(chalk.red.bold('Warning: This URL is blocked by robots.txt.'));
      console.log(chalk.red('Extraction will respect this policy by default.'));
      console.log('');
    }

    if (analysis.repeatedBlocks.length === 0) {
      console.log(chalk.yellow('No repeated data blocks detected on this page.'));
      console.log(chalk.dim('This might not be a list/directory page, or it may require browser rendering.'));
      console.log('');
      state.step = 'done';
      return state;
    }

    // Show detected blocks
    console.log(chalk.bold(`Found ${analysis.repeatedBlocks.length} repeated block group(s):`));
    console.log(formatBlocksTable(analysis.repeatedBlocks));
    console.log('');

    // Auto-select best block
    const bestBlock = analysis.repeatedBlocks[0];
    state.selectedBlock = bestBlock;
    state.fetchMode = analysis.fetchMode;
    console.log(chalk.dim(`Auto-selected: ${bestBlock.selector} (${bestBlock.count} items)`));
    console.log('');

    return state;
  },
};
