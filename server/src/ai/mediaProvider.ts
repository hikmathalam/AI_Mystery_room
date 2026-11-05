import { env } from "../config/env.js";

/**
 * Provider adapter contract: POST { prompt, caseId, evidenceId } and return
 * JSON { url }. The configured provider must return an object-storage URL;
 * image bytes are intentionally never persisted inside MongoDB.
 */
export async function generateEvidenceImage(prompt: string, caseId: string, evidenceId: string): Promise<string | null> {
  if (env.IMAGE_GENERATION_PROVIDER === "disabled" || !env.IMAGE_GENERATION_ENDPOINT) return null;
  try {
    const response = await fetch(env.IMAGE_GENERATION_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.IMAGE_GENERATION_API_KEY ? { authorization: `Bearer ${env.IMAGE_GENERATION_API_KEY}` } : {})
      },
      body: JSON.stringify({ prompt, caseId, evidenceId }),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`Image provider returned HTTP ${response.status}`);
    const body = await response.json() as { url?: unknown };
    if (typeof body.url !== "string") throw new Error("Image provider did not return a storage URL.");
    const url = new URL(body.url);
    if (url.protocol !== "https:") throw new Error("Image provider URL must use HTTPS.");
    return url.toString();
  } catch (error) {
    console.warn(`Optional media generation failed for ${evidenceId}:`, error instanceof Error ? error.message : "provider error");
    return null;
  }
}
