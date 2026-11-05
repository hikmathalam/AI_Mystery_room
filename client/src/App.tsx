import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { ProtectedRoute } from "./components/ProtectedRoute";
const AppLayout = lazy(() => import("./components/AppLayout").then((module) => ({ default: module.AppLayout })));
const LandingPage = lazy(() => import("./pages/LandingPage").then((module) => ({ default: module.LandingPage })));
const AuthPage = lazy(() => import("./pages/AuthPage").then((module) => ({ default: module.AuthPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const CreateMysteryPage = lazy(() => import("./pages/CreateMysteryPage").then((module) => ({ default: module.CreateMysteryPage })));
const GenerationPage = lazy(() => import("./pages/GenerationPage").then((module) => ({ default: module.GenerationPage })));
const InvestigationPage = lazy(() => import("./pages/InvestigationPage").then((module) => ({ default: module.InvestigationPage })));
const VerdictPage = lazy(() => import("./pages/VerdictPage").then((module) => ({ default: module.VerdictPage })));

function RouteLoading() {
  return <div className="boot-screen"><span className="seal-mark">M</span><span>Opening the case file</span></div>;
}

export default function App() {
  const hydrate = useAuthStore((state) => state.hydrate);
  useEffect(() => { void hydrate(); }, [hydrate]);
  return <BrowserRouter><Suspense fallback={<RouteLoading/>}><Routes>
    <Route path="/" element={<LandingPage/>}/>
    <Route path="/login" element={<AuthPage mode="login"/>}/>
    <Route path="/register" element={<AuthPage mode="register"/>}/>
    <Route element={<ProtectedRoute/>}>
      <Route element={<AppLayout/>}>
        <Route path="/dashboard" element={<DashboardPage/>}/>
        <Route path="/create-mystery" element={<CreateMysteryPage/>}/>
        <Route path="/cases/:caseId/generating" element={<GenerationPage/>}/>
        <Route path="/cases/:caseId/investigation" element={<InvestigationPage/>}/>
        <Route path="/cases/:caseId/result" element={<VerdictPage/>}/>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Suspense></BrowserRouter>;
}
