import { useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Fingerprint, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@mystery-room/shared";
import { useAuthStore } from "../store/authStore";
import { errorMessage } from "../services/api";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const user = useAuthStore((state) => state.user);
  if (user) return <Link to="/dashboard" className="auth-already">Your investigation desk is ready. Open dashboard →</Link>;
  return mode === "login" ? <LoginForm/> : <RegisterForm/>;
}

function AuthFrame({ children, mode }: { children: ReactNode; mode: "login"|"register" }) {
  return <div className="auth-screen"><div className="auth-left"><Link to="/" className="brand-lockup"><span className="seal-mark">M</span><span><b>MYSTERY</b><small>INVESTIGATION DESK</small></span></Link><div className="auth-art-copy"><div className="eyebrow"><span className="eyebrow-line"/> PRIVATE INVESTIGATION DESK</div><h1>Some things<br/>don't <em>add up.</em></h1><p>Step into a case built around the details other people overlook.</p><div className="auth-quote"><span>“</span><blockquote>Truth leaves a trail.<br/>The question is who knows how to read it.</blockquote><small>FIELD GUIDE · ENTRY 01</small></div></div><span className="auth-watermark">MR—01</span></div><div className="auth-right"><Link to="/" className="back-link"><ArrowLeft size={15}/> Back to home</Link><div className="auth-card">{children}<div className="auth-privacy"><ShieldCheck size={14}/> Your investigations are private and fictional.</div></div><div className="auth-foot">AI MYSTERY ROOM <span>·</span> {mode === "login"?"WELCOME BACK":"CREATE YOUR ACCOUNT"}</div></div></div>;
}

function LoginForm() {
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  async function submit(values: LoginInput) { setError(""); try { await login(values); navigate((location.state as {from?:string})?.from||"/dashboard",{replace:true}); } catch(e) { setError(errorMessage(e,"Unable to sign in.")); } }
  return <AuthFrame mode="login"><div className="auth-stamp"><Fingerprint size={17}/><span>CASE ACCESS</span></div><h2>Welcome back,<br/><em>detective.</em></h2><p className="auth-subtitle">Your cases are waiting where you left them.</p>{error&&<div className="form-alert">{error}</div>}<form className="auth-form" onSubmit={handleSubmit(submit)} noValidate><label>Email address<input {...register("email")} type="email" autoComplete="email" placeholder="you@example.com"/>{errors.email&&<small className="field-error">{errors.email.message}</small>}</label><label>Password<div className="password-wrap"><input {...register("password")} type={showPassword?"text":"password"} autoComplete="current-password" placeholder="Your password"/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div>{errors.password&&<small className="field-error">{errors.password.message}</small>}</label><div className="form-options"><label className="checkbox-label"><input type="checkbox"/> <span>Keep me signed in</span></label><span className="future-link">Forgot password?</span></div><button type="submit" className="button button-gold auth-submit" disabled={isSubmitting}>{isSubmitting?"Opening your desk":"Sign in to your desk"}<ArrowRight size={16}/></button></form><div className="auth-switch">New to the desk? <Link to="/register">Create an account</Link></div></AuthFrame>;
}

function RegisterForm() {
  const registerUser = useAuthStore((state) => state.register);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), defaultValues: { name: "", email: "", password: "" } });
  async function submit(values: RegisterInput) { setError(""); try { await registerUser(values); navigate("/dashboard",{replace:true}); } catch(e) { setError(errorMessage(e,"Unable to create your account.")); } }
  return <AuthFrame mode="register"><div className="auth-stamp"><Fingerprint size={17}/><span>NEW CASE FILE</span></div><h2>Make this desk<br/><em>your own.</em></h2><p className="auth-subtitle">Create an account to keep your investigations together.</p>{error&&<div className="form-alert">{error}</div>}<form className="auth-form" onSubmit={handleSubmit(submit)} noValidate><label>Full name<input {...register("name")} autoComplete="name" placeholder="How should we address you?"/>{errors.name&&<small className="field-error">{errors.name.message}</small>}</label><label>Email address<input {...register("email")} type="email" autoComplete="email" placeholder="you@example.com"/>{errors.email&&<small className="field-error">{errors.email.message}</small>}</label><label>Password<div className="password-wrap"><input {...register("password")} type={showPassword?"text":"password"} autoComplete="new-password" placeholder="At least 10 characters"/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div>{errors.password&&<small className="field-error">{errors.password.message}</small>}</label><button type="submit" className="button button-gold auth-submit" disabled={isSubmitting}>{isSubmitting?"Preparing your desk":"Create account"}<ArrowRight size={16}/></button></form><div className="auth-switch">Already have a desk? <Link to="/login">Sign in</Link></div></AuthFrame>;
}
