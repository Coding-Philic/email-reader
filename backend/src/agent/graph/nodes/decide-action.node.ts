import { EmailAgentStateType } from '../state';

export function decideActionNode(
  state: EmailAgentStateType,
): Partial<EmailAgentStateType> {
  const slug = state.categorySlug;
  const userRules = state.userRules || {};

  // 1. Check if user has an explicit override rule in settings for this category
  if (userRules[slug]) {
    const customAction = userRules[slug];
    return {
      action: customAction,
      shouldNotifyTelegram: customAction === 'notify' || customAction === 'reply' || state.aiSuggestedNotify || ['job-offers', 'internships', 'important', 'personal'].includes(slug),
      status: 'action_decided',
    };
  }

  // 2. Leverage intelligent AI classification evaluation
  let action: string = 'categorize';
  let shouldNotifyTelegram = false;

  const isHumanInteractiveCategory = ['job-offers', 'internships', 'important', 'personal'].includes(slug);
  const isSpamOrMarketing = ['spam', 'marketing'].includes(slug);

  if (isSpamOrMarketing) {
    action = 'ignore';
    shouldNotifyTelegram = false;
  } else if (state.shouldReply || isHumanInteractiveCategory) {
    // If AI evaluated that this email deserves a reply (or it is a key interactive category), draft a reply!
    action = 'reply';
    shouldNotifyTelegram = true; // ALWAYS notify user on Telegram when an email needs/receives a reply!
  } else if (state.aiSuggestedNotify) {
    action = 'notify';
    shouldNotifyTelegram = true;
  } else {
    // Routine newsletters, transactional receipts, or automated notices
    action = 'categorize';
    shouldNotifyTelegram = false;
  }

  return {
    action,
    shouldNotifyTelegram,
    status: 'action_decided',
  };
}

// Router function for conditional edges
export function routeAction(state: EmailAgentStateType): string {
  switch (state.action) {
    case 'reply':
      return 'draft_reply';
    case 'ignore':
      return 'finalize';
    case 'notify':
      return 'finalize';
    case 'categorize':
      return 'finalize';
    default:
      return 'finalize';
  }
}
