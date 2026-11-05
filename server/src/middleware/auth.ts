import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "../utils/HttpError.js";

export function authRequired(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.mystery_session as string | undefined;
    if (!token) throw new HttpError(401, "Please sign in to continue.", "UNAUTHENTICATED");
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof payload.sub !== "string") throw new HttpError(401, "Your session is invalid. Please sign in again.", "INVALID_SESSION");
    req.userId = payload.sub;
    next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    return next(new HttpError(401, "Your session has expired. Please sign in again.", "SESSION_EXPIRED"));
  }
}
