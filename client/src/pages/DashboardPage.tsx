import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, BarChart3, Clock3, FolderOpen, Plus, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import type { PublicCase } from "@mystery-room/shared";
import { api, errorMessage } from "../services/api";
import { useAuthStore } from "../store/authStore";

type Stats = { totalCases: number; solvedCases: number; activeCases: number; averageScore: number };
const statusNames: Record<string,string> = { GENERATING:"Generating", READY:"Ready to investigate", INVESTIGATING:"In progress", SUBMITTED:"Case unsolved", SOLVED:"Solved", FAILED:"Needs attention" };

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [cases, setCases] = useState<PublicCase[]>([]);
  const [stats, setStats] = useState<Stats>({ totalCases: 0, solvedCases: 0, activeCases: 0, averageScore: 0 });
  const [loadingCases, setLoadingCases] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoadingCases(true);
      api.get("/cases", { params: { page, limit: pageSize, q: query.trim() || undefined } })
        .then(({ data }) => {
          if (!active) return;
          setCases(data.cases);
          setTotal(data.total);
          setTotalPages(Math.max(1, data.totalPages));
          setError("");
        })
        .catch((reason) => { if (active) setError(errorMessage(reason, "Unable to load your case archive.")); })
        .finally(() => { if (active) setLoadingCases(false); });
    }, query ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [page, query]);

  useEffect(() => {
    let active = true;
    api.get("/users/me/statistics")
      .then(({ data }) => { if (active) setStats(data.statistics); })
      .catch((reason) => { if (active) setError(errorMessage(reason, "Unable to load your desk statistics.")); });
    return () => { active = false; };
  }, []);

  return <div className="dashboard-page">
    <div className="page-intro"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR PRIVATE INVESTIGATION DESK</div><h1>Good to see you, <em>{user?.name?.split(" ")[0] || "detective"}.</em></h1><p>Every case starts with a question. What will you investigate today?</p></div><Link to="/create-mystery" className="button button-gold"><Plus size={17}/> Open a new case</Link></div>
    {error && <div className="form-alert" role="status">{error}</div>}
    <div className="stats-grid"><Stat icon={<FolderOpen size={17}/>} label="TOTAL CASES" value={stats.totalCases} foot="Across your desk"/><Stat icon={<Sparkles size={17}/>} label="SOLVED" value={stats.solvedCases} foot="Truth uncovered" tone="green"/><Stat icon={<Clock3 size={17}/>} label="IN PROGRESS" value={stats.activeCases} foot="Waiting on your theory" tone="gold"/><Stat icon={<BarChart3 size={17}/>} label="AVERAGE SCORE" value={stats.averageScore ? `${stats.averageScore}%` : "—"} foot="Across completed cases"/></div>
    <section className="cases-section" id="cases">
      <div className="section-head"><div><div className="section-kicker">THE ARCHIVE</div><h2>Case archive <span>{total.toString().padStart(2, "0")}</span></h2></div><div className="archive-tools"><label className="archive-search"><Search size={15}/><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search all your files" aria-label="Search cases"/></label><Link to="/create-mystery" className="button button-quiet">New case <ArrowUpRight size={15}/></Link></div></div>
      {loadingCases ? <div className="case-loading"><span className="spinner"/> Loading your archive…</div> : cases.length ? <div className="case-grid">{cases.map((item, index) => <CaseCard key={item.id} item={item} index={index}/>)}</div> : query.trim() ? <div className="empty-search">No cases match “{query}”. Try another search.</div> : <div className="empty-archive"><div className="empty-icon"><FolderOpen size={22}/></div><div className="section-kicker">A FRESH FILE</div><h3>No cases on your desk yet.</h3><p>Start with a scenario that has always made you wonder “what if?”</p><Link to="/create-mystery" className="button button-gold">Create your first mystery <ArrowRight size={16}/></Link></div>}
      {totalPages > 1 && <nav className="archive-pagination" aria-label="Case archive pages"><span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} cases</span><div><button type="button" className="button button-quiet button-small" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Previous</button><span>Page {page} of {totalPages}</span><button type="button" className="button button-quiet button-small" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>Next</button></div></nav>}
    </section><div className="dashboard-footnote"><ShieldLabel/> This desk is private. Your fictional case files are visible only to you.</div>
  </div>;
}
function Stat({icon,label,value,foot,tone="blue"}:{icon:ReactNode;label:string;value:string|number;foot:string;tone?:string}) { return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-label">{label}</span><strong>{value}</strong><small>{foot}</small></article>; }

function CaseCard({item,index}:{item:PublicCase;index:number}) {
  const link = item.status === "GENERATING" || item.status === "FAILED" ? `/cases/${item.id}/generating` : item.status === "SUBMITTED" || item.status === "SOLVED" ? `/cases/${item.id}/result` : `/cases/${item.id}/investigation`;
  const date = new Date(item.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  return <Link to={link} className="case-card" style={{animationDelay:`${index*50}ms`}}><div className={`case-card-art art-${index%4}`}><div className="card-art-grid"/><span className="card-file-no">MR—{String(index+1).padStart(3,"0")}</span><span className="card-art-stamp">{item.genre?.split(" ")[0]?.toUpperCase()||"CASE"}</span><div className="card-art-shape"/><span className="case-card-status"><i className={`status-dot ${item.status.toLowerCase()}`}/>{statusNames[item.status]||item.status}</span></div><div className="case-card-content"><div className="case-card-meta"><span>{item.genre}</span><span>·</span><span>{date}</span></div><h3>{item.title||"Untitled investigation"}</h3><p>{item.description||"A new case file is being prepared."}</p><div className="case-card-footer"><span className={`difficulty-pill difficulty-${item.difficulty.toLowerCase()}`}>{item.difficulty}</span><span>{item.suspectCount} suspects</span><span className="card-open">Open file <ArrowRight size={14}/></span></div></div></Link>;
}
function ShieldLabel(){return <span className="shield-label"><span>◈</span></span>}
