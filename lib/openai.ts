import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey && typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
  console.warn('OPENAI_API_KEY is not set. Set it in .env to use OpenAI APIs.');
}

export const openai = apiKey ? new OpenAI({ apiKey }) : null;

// Model IDs from env (design doc: gpt-5-nano/mini etc. map to current IDs; swap via env later)
export const MODELS = {
  slides: process.env.OPENAI_MODEL_SLIDES || 'gpt-4o-mini',
  full: process.env.OPENAI_MODEL_FULL || 'gpt-4o-mini',
  fullUpgrade: process.env.OPENAI_MODEL_FULL_UPGRADE || 'gpt-4o',
  folder: process.env.OPENAI_MODEL_FOLDER || 'gpt-4o-mini',
  transcript: process.env.OPENAI_MODEL_TRANSCRIPT || 'gpt-4o-mini',
  qa: process.env.OPENAI_MODEL_QA || 'gpt-4o-mini',
  qaUpgrade: process.env.OPENAI_MODEL_QA_UPGRADE || 'gpt-4o',
  questions: process.env.OPENAI_MODEL_QUESTIONS || 'gpt-4o-mini',
  vision: process.env.OPENAI_MODEL_VISION || 'gpt-4o-mini',
  transcribe: process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1',
} as const;

export type OpenAIModelKey = keyof typeof MODELS;

/** Chat completion with optional JSON response format. */
export async function chatCompletion(params: {
  model: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  responseFormat?: 'json_object' | 'text';
  maxTokens?: number;
}): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI client is not configured. Set OPENAI_API_KEY in .env.');
  }
  const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: params.model,
    messages: params.messages,
    max_tokens: params.maxTokens ?? 4096,
  };
  if (params.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }
  const completion = await openai.chat.completions.create(body);
  const content = completion.choices[0]?.message?.content;
  if (content == null) {
    throw new Error('OpenAI returned empty content');
  }
  return content;
}
