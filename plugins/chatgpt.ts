
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: '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',
  dangerouslyAllowBrowser: true,
});

export async function run(params: { prompt: string }) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: params.prompt }],
    });
    return {
      success: true,
      output: response.choices[0].message.content,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
