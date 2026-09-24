export const DEFAULT_TEXT_MODEL = "gpt-5-mini";

/** The OpenAI model for summaries and signature research. */
export function textModel() {
  return process.env.OPENAI_MODEL || DEFAULT_TEXT_MODEL;
}
