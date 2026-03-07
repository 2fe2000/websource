import { checkbox, input } from '@inquirer/prompts';
import chalk from 'chalk';
import type { ConversationState, Field } from '../../../shared/types.js';
import type { StepHandler } from '../conversation.js';

export const pickFieldsStep: StepHandler = {
  canSkip(state) {
    return !state.analysis || state.analysis.suggestedFields.length === 0;
  },

  async enter(state) {
    const suggested = state.analysis!.suggestedFields;

    const selectedNames = await checkbox({
      message: 'Which fields do you want to extract?',
      choices: suggested.map((f) => ({
        name: `${f.name} (${f.inferredType}) — ${f.sampleValues[0] ?? 'no sample'}`,
        value: f.name,
        checked: f.confidence > 0.5,
      })),
    });

    if (selectedNames.length === 0) {
      console.log(chalk.yellow('No fields selected. Using all detected fields.'));
      state.selectedFields = suggested.map(toField);
      return state;
    }

    const selectedSuggested = suggested.filter((f) => selectedNames.includes(f.name));
    state.selectedFields = selectedSuggested.map(toField);

    console.log('');
    console.log(chalk.green(`Selected ${state.selectedFields.length} field(s): ${state.selectedFields.map((f) => f.name).join(', ')}`));
    console.log('');

    return state;
  },
};

function toField(suggested: { name: string; selector: string; fallbackSelectors: string[]; inferredType: any; confidence: number }): Field {
  return {
    name: suggested.name,
    selector: suggested.selector,
    fallbackSelectors: suggested.fallbackSelectors,
    type: suggested.inferredType,
    required: suggested.confidence > 0.8 && ['title', 'url'].includes(suggested.name),
  };
}
