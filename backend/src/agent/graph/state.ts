import { Annotation } from '@langchain/langgraph';

export const EmailAgentState = Annotation.Root({
  // Input
  userId: Annotation<string>,
  emailId: Annotation<string>,
  threadId: Annotation<string>,
  from: Annotation<string>,
  fromName: Annotation<string>,
  subject: Annotation<string>,
  body: Annotation<string>,
  snippet: Annotation<string>,

  // Classification output
  category: Annotation<string>,
  categorySlug: Annotation<string>,
  confidence: Annotation<number>,
  isNewCategory: Annotation<boolean>,
  shouldReply: Annotation<boolean>,
  aiSuggestedNotify: Annotation<boolean>,

  // Action decision
  action: Annotation<string>, // 'reply' | 'ignore' | 'notify' | 'categorize'
  shouldNotifyTelegram: Annotation<boolean>,

  // Reply draft
  replyDraft: Annotation<string>,

  // User preferences
  userRules: Annotation<Record<string, string>>,
  autoReplyEnabled: Annotation<boolean>,
  customAiInstructions: Annotation<string>,

  // Processing status
  status: Annotation<string>,
  error: Annotation<string>,
});

export type EmailAgentStateType = typeof EmailAgentState.State;
