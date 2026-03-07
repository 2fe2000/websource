import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import type { ConversationState } from '../../../shared/types.js';
import type { StepHandler } from '../conversation.js';

const PRESETS: Record<string, { label: string; cron: string }> = {
  manual: { label: 'Manual only (no schedule)', cron: '' },
  hourly: { label: 'Every hour', cron: '0 * * * *' },
  daily: { label: 'Once a day (midnight)', cron: '0 0 * * *' },
  weekly: { label: 'Once a week (Sunday midnight)', cron: '0 0 * * 0' },
};

export const refreshCadenceStep: StepHandler = {
  async enter(state) {
    const preset = await select({
      message: 'How often should this source be refreshed?',
      choices: Object.entries(PRESETS).map(([value, { label }]) => ({ name: label, value })),
    });

    if (preset !== 'manual') {
      const { cron } = PRESETS[preset];
      state.schedule = { cronExpr: cron, preset };
      console.log(chalk.green(`Schedule set: ${PRESETS[preset].label} (${cron})`));
    } else {
      console.log(chalk.dim('No schedule set. You can run extractions manually.'));
    }

    console.log('');
    return state;
  },
};
