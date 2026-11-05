import { env } from "../config/env.js";
import { HttpError } from "../utils/HttpError.js";
import { parseValidatedJson } from "./validation.js";

type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };

const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

class GeminiResponseError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "GeminiResponseError";
  }
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryable(error: unknown) {
  if (error instanceof GeminiResponseError) return RETRYABLE_STATUSES.has(error.status);
  if (error instanceof Error) return error.name === "AbortError" || error.name === "TimeoutError" || error instanceof TypeError;
  return false;
}

export async function generateJson<T>(systemPrompt: string, userPrompt: string, validate: (value: unknown) => T): Promise<T> {
  if (!env.GEMINI_API_KEY) throw new HttpError(503, "Case generation is unavailable until the server is configured with a Gemini API key.", "AI_NOT_CONFIGURED");
  const model = encodeURIComponent(env.GEMINI_MODEL);
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        signal: AbortSignal.timeout(90000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 }
        })
      });
      const body = await response.json() as GeminiResponse;
      if (!response.ok) throw new GeminiResponseError(response.status, body.error?.message || `Gemini returned HTTP ${response.status}`);
      const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
      if (!text) throw new Error("Gemini returned an empty response.");
      return parseValidatedJson(text, validate);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === MAX_ATTEMPTS - 1) break;
      const backoffMs = Math.min(4000, 1000 * 2 ** attempt);
      await wait(backoffMs + Math.floor(Math.random() * 250));
    }
  }
  console.error("Gemini generation failed:", lastError);
  if (lastError instanceof GeminiResponseError && lastError.status === 503) {
    throw new HttpError(503, "Gemini is temporarily overloaded. Please retry this case in a moment.", "AI_TEMPORARILY_UNAVAILABLE");
  }
  if (lastError instanceof GeminiResponseError && lastError.status === 429) {
    throw new HttpError(503, "Gemini is temporarily rate-limited. Please wait a moment, then retry this case.", "AI_RATE_LIMITED");
  }
  throw new HttpError(502, "The case could not be generated right now. Please retry in a moment.", "AI_GENERATION_FAILED");
}
