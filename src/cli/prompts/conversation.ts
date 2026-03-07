import type { ConversationState, ConversationStep } from '../../shared/types.js';
import { analyzeStep } from './steps/analyze-site.js';
import { proposeFieldsStep } from './steps/propose-fields.js';
import { pickFieldsStep } from './steps/pick-fields.js';
import { detailPagesStep } from './steps/detail-pages.js';
import { refreshCadenceStep } from './steps/refresh-cadence.js';
import { confirmStep } from './steps/confirm.js';

export interface StepHandler {
  enter(state: ConversationState): Promise<ConversationState>;
  canSkip?(state: ConversationState): boolean;
}

const STEPS: Array<{ step: ConversationStep; handler: StepHandler }> = [
  { step: 'analyzing', handler: analyzeStep },
  { step: 'propose-fields', handler: proposeFieldsStep },
  { step: 'pick-fields', handler: pickFieldsStep },
  { step: 'detail-pages', handler: detailPagesStep },
  { step: 'refresh-cadence', handler: refreshCadenceStep },
  { step: 'confirm', handler: confirmStep },
];

export async function runConversation(url: string): Promise<ConversationState> {
  let state: ConversationState = { step: 'url-input', url };

  for (const { step, handler } of STEPS) {
    if (handler.canSkip?.(state)) {
      continue;
    }

    state.step = step;
    state = await handler.enter(state);

    if (state.step === 'done') break;
  }

  state.step = 'done';
  return state;
}
