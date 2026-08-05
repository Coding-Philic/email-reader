import { ChatGroq } from '@langchain/groq';
import { EmailAgentStateType } from '../state';

const replyPrompt = `You are an executive personal assistant AI drafting a highly contextual, natural, and polite reply to the incoming email on behalf of the user.

Guidelines:
- Tailor the response tone directly to the relationship and context (e.g., formal and grateful for recruiters/internship offers; respectful and acknowledged for college professors/superiors; warm and concise for personal contacts/friends).
- Address the exact questions, deadlines, or topics raised in the email naturally.
- Be concise (2 to 4 well-structured sentences).
- Express sincere appreciation when appropriate (e.g. thanking recruiters for reaching out or checking in).
- Avoid robotic cliches (do not say "As an AI..." or "I am writing to acknowledge..."). Write as a real professional human assistant/user.
- Include an appropriate professional sign-off (e.g. "Best regards,", "Thanks again,", etc.).

User's Custom AI Reply Instructions & Preferences:
{customAiInstructions}
IMPORTANT: Adhere strictly to the user's instructions above when formulating the tone, content, or sign-off of your reply!

Original Email Details:
From: {fromName} <{from}>
Subject: {subject}
Full Email Content:
{body}

Write ONLY the exact reply message body text below (ready to be sent immediately):`;

export async function draftReplyNode(
  state: EmailAgentStateType,
): Promise<Partial<EmailAgentStateType>> {
  try {
    const llm = new ChatGroq({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
    });

    const prompt = replyPrompt
      .replace('{customAiInstructions}', state.customAiInstructions || 'None provided.')
      .replace('{fromName}', state.fromName || 'Unknown')
      .replace('{from}', state.from || 'unknown@email.com')
      .replace('{subject}', state.subject || 'No Subject')
      .replace('{body}', (state.body || state.snippet || '').substring(0, 3000));

    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string' ? response.content : '';

    return {
      replyDraft: content.trim(),
      status: 'reply_drafted',
    };
  } catch (error) {
    return {
      replyDraft: '',
      status: 'reply_draft_failed',
      error: (error as Error).message,
    };
  }
}
