import chalk from 'chalk';
import type { ConversationState } from '../../../shared/types.js';
import { formatFieldsTable } from '../../formatters/table.js';
import type { StepHandler } from '../conversation.js';

export const proposeFieldsStep: StepHandler = {
  canSkip(state) {
    return !state.analysis || state.analysis.suggestedFields.length === 0;
  },

  async enter(state) {
    const fields = state.analysis!.suggestedFields;

    console.log(chalk.bold(`Detected ${fields.length} extractable field(s):`));
    console.log('');
    console.log(formatFieldsTable(fields));
    console.log('');

    if (state.analysis!.paginationHints.length > 0) {
      const best = state.analysis!.paginationHints[0];
      console.log(chalk.dim(`Pagination detected: ${best.strategy} (${Math.round(best.confidence * 100)}% confidence)`));
      console.log('');
    }

    return state;
  },
};
