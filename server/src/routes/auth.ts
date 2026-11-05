import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { loginSchema, registerSchema } from "@mystery-room/shared";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/HttpError.js";
import { authRequired } from "../middleware/auth.js";

export const authRouter = Router();
const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE === "true",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000
};
const publicUser = (user: { _id: unknown; name: string; email: string; avatar?: string }) => ({ id: String(user._id), name: user.name, email: user.email, avatar: user.avatar || "" });

function issueSession(userId: string, res: Response) {
  const token = jwt.sign({}, env.JWT_SECRET, { subject: userId, expiresIn: "7d" });
  res.cookie("mystery_session", token, cookieOptions);
}

authRouter.post("/register", async (req, res) => {
  const input = registerSchema.parse(req.body);
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new HttpError(409, "An account with that email already exists.", "EMAIL_IN_USE");
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({ name: input.name, email: input.email.toLowerCase(), passwordHash });
  issueSession(String(user._id), res);
  res.status(201).json({ success: true, user: publicUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await User.findOne({ email: input.email.toLowerCase() }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw new HttpError(401, "Email or password is incorrect.", "INVALID_CREDENTIALS");
  issueSession(String(user._id), res);
  res.json({ success: true, user: publicUser(user) });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("mystery_session", { httpOnly: true, secure: env.COOKIE_SECURE === "true", sameSite: "lax", path: "/" });
  res.json({ success: true });
});

authRouter.get("/me", authRequired, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, "Your account could not be found.", "USER_NOT_FOUND");
  res.json({ success: true, user: publicUser(user) });
});
