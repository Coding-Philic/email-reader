import { ChatGroq } from '@langchain/groq';
import { EmailAgentStateType } from '../state';

const classificationPrompt = `You are an expert executive email assistant AI. Analyze the following email, classify it into the most accurate category, and determine whether it requires an automatic professional reply or instant notification.

Available categories:
- job-offers: Job opportunities, recruitment, interview invitations, hiring discussions
- internships: Internship opportunities, student applications, programs, offers
- important: Urgent or high-priority emails, college/university notices, deadlines, direct inquiries from colleagues or superiors
- personal: Personal correspondence, notes from friends, family, or known individual contacts
- newsletters: Subscribed newsletters, weekly digests, industry roundups
- marketing: Promotional offers, sales, advertisements, coupons
- social: Social media notifications (LinkedIn, Twitter, Facebook, forums)
- transactional: Receipts, invoices, confirmations, order shipping updates, automated alerts
- spam: Unwanted, unsolicited, suspicious or phishing attempts

If the email does not fit any category above, create a descriptive new category slug and name.

Decision Guidelines:
1. "shouldReply": Evaluate to true ONLY if this is an individual human communication that warrants a courteous reply or acknowledgment (e.g., job recruiters asking for availability, internship responses, personal messages, direct questions from college/colleagues, or interview invitations). Set to false ONLY for automated receipts, mass promotions, newsletters, spam, or no-reply alerts.
2. "shouldNotify": Evaluate to true for ANY email that is personally relevant, time-sensitive, or important for the user to see immediately on Telegram (including job offers, internships, important college/work communications, personal messages, or direct inquiries). Set to false for spam, marketing ads, routine newsletters, and trivial automated notices.

User's Custom AI Instructions & Rules (HIGHEST PRIORITY OVERRIDE):
{customAiInstructions}
IMPORTANT: Always follow the User's Custom AI Instructions above. If the instructions say to reply to or ignore a specific email sender or topic, strictly honor those rules above all default guidelines!

Email Details:
From: {fromName} <{from}>
Subject: {subject}
Body (truncated):
{body}

Respond in this exact JSON format only, no additional commentary or text:
{
  "category": "category-slug",
  "categoryName": "Human Readable Name",
  "confidence": 0.95,
  "isNewCategory": false,
  "shouldReply": true,
  "shouldNotify": true,
  "reasoning": "Brief explanation of why this email deserves a reply or alert"
}`;

export async function classifyNode(
  state: EmailAgentStateType,
): Promise<Partial<EmailAgentStateType>> {
  try {
    const llm = new ChatGroq({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
    });

    const prompt = classificationPrompt
      .replace('{customAiInstructions}', state.customAiInstructions || 'No custom instructions specified by user.')
      .replace('{fromName}', state.fromName || 'Unknown')
      .replace('{from}', state.from || 'unknown@email.com')
      .replace('{subject}', state.subject || 'No Subject')
      .replace('{body}', (state.body || state.snippet || 'Empty email').substring(0, 3000));

    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string' ? response.content : '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse classification response');
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      category: result.categoryName || 'Unknown',
      categorySlug: result.category || 'unknown',
      confidence: result.confidence || 0.5,
      isNewCategory: result.isNewCategory || false,
      shouldReply: result.shouldReply !== undefined ? Boolean(result.shouldReply) : false,
      aiSuggestedNotify: result.shouldNotify !== undefined ? Boolean(result.shouldNotify) : false,
      status: 'classified',
    };
  } catch (error) {
    return {
      category: 'Unknown',
      categorySlug: 'unknown',
      confidence: 0,
      isNewCategory: false,
      shouldReply: false,
      aiSuggestedNotify: false,
      status: 'classification_failed',
      error: (error as Error).message,
    };
  }
}
