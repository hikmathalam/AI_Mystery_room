import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.js";
import { caseRouter } from "./routes/cases.js";
import { userRouter } from "./routes/users.js";
import { errorHandler, notFound } from "./middleware/errors.js";

export const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: { directives: { "img-src": ["'self'", "data:", "https:"] } } }));
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res, _next, options) => res.status(options.statusCode).json({ success: false, message: "Too many authentication attempts. Please wait a few minutes before trying again.", code: "RATE_LIMITED" })
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 180,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res, _next, options) => res.status(options.statusCode).json({ success: false, message: "Too many requests. Please wait a moment before trying again.", code: "RATE_LIMITED" })
});
app.get("/health", (_req, res) => res.json({ success: true, service: "ai-mystery-room", status: "ok" }));
app.use("/api/v1", apiLimiter);
app.use("/api/v1/auth", authLimiter, authRouter);
app.use("/api/v1/cases", caseRouter);
app.use("/api/v1/users", userRouter);
app.use(notFound);
app.use(errorHandler);
