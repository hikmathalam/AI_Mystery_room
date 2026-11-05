import dotenv from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config();

const envSchema = z.object({
  SERVER_PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.8-flash"),
  IMAGE_GENERATION_PROVIDER: z.string().default("disabled"),
  IMAGE_GENERATION_API_KEY: z.string().optional().default(""),
  IMAGE_GENERATION_ENDPOINT: z.string().optional().default("")
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid server configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
