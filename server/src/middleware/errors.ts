import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/HttpError.js";

export const notFound: RequestHandler = (_req, _res, next) => next(new HttpError(404, "This route could not be found.", "NOT_FOUND"));

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ success: false, message: "Some of the submitted details need attention.", code: "VALIDATION_ERROR", details: error.flatten().fieldErrors });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ success: false, message: error.message, code: error.code });
    return;
  }
  if (error?.code === 11000) {
    const emailConflict = Boolean(error.keyPattern?.email);
    res.status(409).json({ success: false, message: emailConflict ? "An account with that email already exists." : "This item already exists.", code: "DUPLICATE_RECORD" });
    return;
  }
  console.error("Unhandled API error:", error);
  res.status(500).json({ success: false, message: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" });
};
