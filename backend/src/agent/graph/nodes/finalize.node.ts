import { EmailAgentStateType } from '../state';

export function finalizeNode(
  state: EmailAgentStateType,
): Partial<EmailAgentStateType> {
  return {
    status: 'completed',
  };
}
