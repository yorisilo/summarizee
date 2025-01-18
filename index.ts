import { configDotenv } from 'dotenv';
import { Hono } from 'hono';
import parse from 'node-html-parser';
import OpenAI from 'openai';

configDotenv();

const aiClient = new OpenAI({
  apiKey: process.env['OPEN_API_KEY']
});

const lineSize = 40;

const detailLevels = {
  S: 3,
  M: 10,
  L: 30
};

const app = new Hono();

const extractText = (html: string): string => {
  const root = parse(html);
  return root.querySelector('body')?.textContent || '';
};

const generateSummary = async (content: string, lines: number): Promise<string> => {
  const prompt = `以下のテキストを指定された行数で要約してください。文章は途中で切れないようにしてください。1行の長さは${lineSize}に収めるようにしてください。\n行数: ${lines}\nテキスト: ${content} `;

  const response = await aiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: lines * lineSize
  });

  return response.choices[0]?.message?.content?.trim() || '';
};

const handler = async (url: string, detail: keyof typeof detailLevels): Promise<string> => {
  const response = await fetch(url);

  if (!response.ok) {
    return 'failed...';
  }

  const html = await response.text();
  const text = extractText(html);
  const lines = detailLevels[detail];

  const summary = await generateSummary(text, lines);
  return summary;
};

type SummarizeRequest = {
  url: string;
  detail: keyof typeof detailLevels;
};

type ErrorResponse = {
  error: string;
};

type SummarizeResponse = {
  summary: string;
};

app.post('/summarize', async (c) => {
  const body = await c.req.json<SummarizeRequest>();
  const { url, detail } = body;

  if (!url || !detailLevels.hasOwnProperty(detail)) {
    return c.json<ErrorResponse>({ error: 'Invalid parameters' }, 400);
  }

  const summary = await handler(url, detail);
  return c.json<SummarizeResponse>({ summary });
});

export default app;
