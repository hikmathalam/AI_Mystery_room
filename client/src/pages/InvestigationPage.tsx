import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, BookMarked, Check, ChevronRight, Clock3, FileText, Filter, MapPin, MessageCircle, Network, NotebookPen, Search, ShieldCheck, Users, Video, X, Image as ImageIcon, Siren, Scale, Gavel, AlertTriangle, CircleDot, LockKeyhole } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { InvestigationBoard, JournalEntry, PublicCase, PublicEvidence, PublicInvestigation, PublicSuspect } from "@mystery-room/shared";
import { api, errorMessage } from "../services/api";
import { EvidenceBoard } from "../components/EvidenceBoard";
import { DetectiveJournal } from "../components/DetectiveJournal";

type Section="overview"|"evidence"|"board"|"timeline"|"notes"|"journal";
const categories=[{key:"ALL",label:"All evidence",icon:Filter},{key:"CHAT",label:"Conversations",icon:MessageCircle},{key:"IMAGE",label:"Photographs",icon:ImageIcon},{key:"CCTV",label:"CCTV",icon:Video},{key:"WITNESS",label:"Witness statements",icon:Users},{key:"DOCUMENT",label:"Documents",icon:FileText},{key:"DIGITAL",label:"Digital records",icon:CircleDot}];
const categoryName:Record<string,string>={CHAT:"Conversation",IMAGE:"Photograph",CCTV:"CCTV · SIMULATED",WITNESS:"Witness statement",DOCUMENT:"Document",DIGITAL:"Digital record",OTHER:"Evidence"};
const iconForCategory:Record<string,typeof FileText>={CHAT:MessageCircle,IMAGE:ImageIcon,CCTV:Video,WITNESS:Users,DOCUMENT:FileText,DIGITAL:CircleDot,OTHER:FileText};

function progressValue(evidenceCount: number, suspectCount: number, examined: number, reviewed: number, flagged: number, timelineReviewed: boolean) {
  const evidence = evidenceCount ? examined / evidenceCount : 0;
  const suspects = suspectCount ? reviewed / suspectCount : 0;
  const clues = evidenceCount ? flagged / evidenceCount : 0;
  return Math.round(100 * (evidence * 0.45 + suspects * 0.25 + (timelineReviewed ? 0.2 : 0) + clues * 0.1));
}

export function InvestigationPage() {
  const { caseId = "" } = useParams();
  const navigate = useNavigate();
  const [caseFile, setCaseFile] = useState<PublicCase | null>(null);
  const [suspects, setSuspects] = useState<PublicSuspect[]>([]);
  const [evidence, setEvidence] = useState<PublicEvidence[]>([]);
  const [investigation, setInvestigation] = useState<PublicInvestigation | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [category, setCategory] = useState("ALL");
  const [timelineCategory, setTimelineCategory] = useState("ALL");
  const [timelineSuspect, setTimelineSuspect] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<PublicEvidence | null>(null);
  const [selectedSuspect, setSelectedSuspect] = useState<PublicSuspect | null>(null);
  const [accusationOpen, setAccusationOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalSaving, setJournalSaving] = useState(false);
  const [board, setBoard] = useState<InvestigationBoard>({ nodes: [], edges: [] });
  const [boardSaving, setBoardSaving] = useState(false);
  const [confidenceRatings, setConfidenceRatings] = useState<PublicInvestigation["confidenceRatings"]>([]);
  const [confidenceSaving, setConfidenceSaving] = useState(false);
  const [accuseSuspect, setAccuseSuspect] = useState("");
  const [explanation, setExplanation] = useState("");
  const [supportingEvidence, setSupportingEvidence] = useState<string[]>([]);
  const [accuseError, setAccuseError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const notesHydrated = useRef(false);
  const journalHydrated = useRef(false);
  const boardHydrated = useRef(false);
  const confidenceHydrated = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get(`/cases/${caseId}`),
      api.get(`/cases/${caseId}/suspects`),
      api.get(`/cases/${caseId}/evidence`),
      api.get(`/cases/${caseId}/investigation`)
    ]).then(([caseResult, suspectResult, evidenceResult, investigationResult]) => {
      if (!active) return;
      const currentInvestigation = investigationResult.data.investigation as PublicInvestigation;
      setCaseFile(caseResult.data.case);
      setSuspects(suspectResult.data.suspects);
      setEvidence(evidenceResult.data.evidence);
      setInvestigation(currentInvestigation);
      setNoteDraft(currentInvestigation.notes || "");
      setJournalEntries(currentInvestigation.journalEntries || []);
      setBoard(currentInvestigation.board || { nodes: [], edges: [] });
      setConfidenceRatings(currentInvestigation.confidenceRatings || []);
    }).catch((reason) => {
      if (!active) return;
      const message = errorMessage(reason, "Unable to open this investigation.");
      if (message.toLowerCase().includes("generation")) navigate(`/cases/${caseId}/generating`, { replace: true });
      else setError(message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [caseId, navigate]);

  const readOnly = investigation?.isSubmitted || false;
  const hasInvestigation = Boolean(investigation);
  useEffect(() => {
    if (!hasInvestigation || readOnly) return;
    if (!notesHydrated.current) { notesHydrated.current = true; return; }
    const snapshot = noteDraft;
    const timer = window.setTimeout(async () => {
      setNoteSaving(true);
      try {
        await api.patch(`/cases/${caseId}/investigation/notes`, { notes: snapshot });
        setInvestigation((current) => current ? { ...current, notes: snapshot } : current);
      } catch (reason) {
        setError(errorMessage(reason, "Your field notes could not be saved."));
      } finally {
        setNoteSaving(false);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [caseId, hasInvestigation, noteDraft, readOnly]);

  useEffect(() => {
    if (!hasInvestigation || readOnly) return;
    if (!journalHydrated.current) { journalHydrated.current = true; return; }
    const timer = window.setTimeout(async () => {
      setJournalSaving(true);
      try { await api.patch(`/cases/${caseId}/investigation/journal`, { entries: journalEntries }); }
      catch (reason) { setError(errorMessage(reason, "Your journal could not be saved.")); }
      finally { setJournalSaving(false); }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [caseId, hasInvestigation, journalEntries, readOnly]);

  useEffect(() => {
    if (!hasInvestigation || readOnly) return;
    if (!boardHydrated.current) { boardHydrated.current = true; return; }
    const timer = window.setTimeout(async () => {
      setBoardSaving(true);
      try { await api.patch(`/cases/${caseId}/investigation/board`, board); }
      catch (reason) { setError(errorMessage(reason, "Your evidence board could not be saved.")); }
      finally { setBoardSaving(false); }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [board, caseId, hasInvestigation, readOnly]);

  useEffect(() => {
    if (!hasInvestigation || readOnly) return;
    if (!confidenceHydrated.current) { confidenceHydrated.current = true; return; }
    const timer = window.setTimeout(async () => {
      setConfidenceSaving(true);
      try { await api.patch(`/cases/${caseId}/investigation/confidence`, { ratings: confidenceRatings }); }
      catch (reason) { setError(errorMessage(reason, "Your confidence ratings could not be saved.")); }
      finally { setConfidenceSaving(false); }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [caseId, confidenceRatings, hasInvestigation, readOnly]);

  const filteredEvidence = useMemo(() => evidence.filter((item) =>
    (category === "ALL" || item.category === category) &&
    `${item.title} ${item.description} ${item.content} ${item.clueText}`.toLowerCase().includes(query.toLowerCase())
  ), [evidence, category, query]);

  const sortedEvidence = useMemo(() => [...evidence].sort((a, b) => {
    const first = Date.parse(a.timestamp);
    const second = Date.parse(b.timestamp);
    return Number.isNaN(first) || Number.isNaN(second) ? a.timestamp.localeCompare(b.timestamp) : first - second;
  }), [evidence]);

  const timelineEvidence = useMemo(() => sortedEvidence.filter((item) =>
    (timelineCategory === "ALL" || item.category === timelineCategory) &&
    (timelineSuspect === "ALL" || item.relatedSuspectIds.includes(timelineSuspect))
  ), [sortedEvidence, timelineCategory, timelineSuspect]);

  const examinedEvidence = useMemo(() => evidence.filter((item) => investigation?.examinedEvidenceIds.includes(item.evidenceId)), [evidence, investigation?.examinedEvidenceIds]);
  const reviewedSuspects = useMemo(() => suspects.filter((item) => investigation?.investigatedSuspectIds.includes(item.suspectId)), [suspects, investigation?.investigatedSuspectIds]);

  function updateProgress(patch: { examinedEvidenceId?: string; investigatedSuspectId?: string; timelineReviewed?: boolean }) {
    if (!investigation || readOnly) return;
    api.patch(`/cases/${caseId}/investigation/progress`, patch)
      .then(({ data }) => setInvestigation(data.investigation))
      .catch((reason) => setError(errorMessage(reason, "Your investigation progress could not be saved.")));
  }

  function openEvidence(item: PublicEvidence) {
    setSelectedEvidence(item);
    if (!investigation?.isSubmitted && !investigation?.examinedEvidenceIds.includes(item.evidenceId)) updateProgress({ examinedEvidenceId: item.evidenceId });
  }

  function openSuspect(item: PublicSuspect) {
    setSelectedSuspect(item);
    if (!investigation?.isSubmitted && !investigation?.investigatedSuspectIds.includes(item.suspectId)) updateProgress({ investigatedSuspectId: item.suspectId });
  }

  function selectSection(next: Section) {
    setSection(next);
    if (next === "timeline" && !investigation?.timelineReviewed) updateProgress({ timelineReviewed: true });
  }

  async function toggleBookmark(item: PublicEvidence) {
    if (!investigation || investigation.isSubmitted) return;
    const exists = investigation.markedEvidence.includes(item.evidenceId);
    const next = exists ? investigation.markedEvidence.filter((id) => id !== item.evidenceId) : [...investigation.markedEvidence, item.evidenceId];
    setInvestigation({ ...investigation, markedEvidence: next, progress: progressValue(evidence.length, suspects.length, investigation.examinedEvidenceIds.length, investigation.investigatedSuspectIds.length, next.length, investigation.timelineReviewed) });
    try {
      const { data } = exists
        ? await api.delete(`/cases/${caseId}/evidence/${item.evidenceId}/bookmark`)
        : await api.post(`/cases/${caseId}/evidence/${item.evidenceId}/bookmark`);
      setInvestigation((current) => current ? { ...current, markedEvidence: data.markedEvidence, progress: progressValue(evidence.length, suspects.length, current.examinedEvidenceIds.length, current.investigatedSuspectIds.length, data.markedEvidence.length, current.timelineReviewed) } : current);
    } catch (reason) {
      setError(errorMessage(reason, "Could not update your evidence marks."));
    }
  }

  function updateConfidence(suspectId: string, confidence: number) {
    setConfidenceRatings((current) => {
      const found = current.some((item) => item.suspectId === suspectId);
      return found
        ? current.map((item) => item.suspectId === suspectId ? { ...item, confidence } : item)
        : [...current, { suspectId, confidence }];
    });
  }

  function addJournalEntry() {
    if (readOnly || journalEntries.length >= 50) return;
    const entry: JournalEntry = { id: crypto.randomUUID(), type: "NOTE", title: "Field note", content: "Write down what you noticed and why it matters…", evidenceIds: [], suspectIds: [], createdAt: new Date().toISOString() };
    setJournalEntries((current) => [entry, ...current]);
  }

  function deleteJournalEntry(id: string) {
    if (!readOnly) setJournalEntries((current) => current.filter((entry) => entry.id !== id));
  }

  async function saveNotes() {
    if (!investigation || readOnly) return;
    setNoteSaving(true);
    try {
      await api.patch(`/cases/${caseId}/investigation/notes`, { notes: noteDraft });
      setInvestigation((current) => current ? { ...current, notes: noteDraft } : current);
    } catch (reason) {
      setError(errorMessage(reason, "Your field notes could not be saved."));
    } finally { setNoteSaving(false); }
  }

  async function submitAccusation(event: FormEvent) {
    event.preventDefault();
    setAccuseError("");
    if (!accuseSuspect) { setAccuseError("Select one suspect before submitting."); return; }
    setSubmitting(true);
    try {
      await api.post(`/cases/${caseId}/accusation`, { suspectId: accuseSuspect, explanation, supportingEvidenceIds: supportingEvidence });
      navigate(`/cases/${caseId}/result`);
    } catch (reason) {
      setAccuseError(errorMessage(reason, "Your accusation could not be submitted."));
      setSubmitting(false);
    }
  }

  if (loading) return <div className="case-loading full-loading"><span className="spinner"/> Opening the case file…</div>;
  if (error && !caseFile) return <div className="investigation-error"><div className="section-kicker">CASE FILE UNAVAILABLE</div><h2>We couldn't open this investigation.</h2><p>{error}</p><Link to="/dashboard" className="button button-quiet"><ArrowLeft size={15}/> Return to your desk</Link></div>;
  if (!caseFile || !investigation) return null;

  const sections: Array<{ key: Section; label: string; icon: typeof FileText }> = [
    { key: "overview", label: "Case dossier", icon: BookOpen },
    { key: "evidence", label: "Exhibit archive", icon: FileText },
    { key: "board", label: "Evidence board", icon: Network },
    { key: "timeline", label: "Timeline", icon: Clock3 },
    { key: "notes", label: "Field notes", icon: NotebookPen },
    { key: "journal", label: "Detective journal", icon: BookMarked }
  ];

  return <div className="investigation-page">
    <div className="case-route-top"><Link to="/dashboard"><ArrowLeft size={14}/> Archive</Link><span>/</span><span>Case {caseId.slice(-6).toUpperCase()}</span><span className="route-status"><i className={`status-dot ${caseFile.status.toLowerCase()}`}/> {readOnly ? "CASE CLOSED" : "INVESTIGATING"}</span></div>
    <div className="investigation-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> {caseFile.genre.toUpperCase()} · {caseFile.difficulty.toUpperCase()}</div><h1>{caseFile.title}</h1><p>{caseFile.description}</p></div><div className="heading-case-id"><small>CASE NUMBER</small><b>MR—{caseId.slice(-6).toUpperCase()}</b></div></div>
    {error && <div className="inline-alert" role="status">{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss"><X size={14}/></button></div>}
    <div className="investigation-metadata"><span><MapPin size={14}/>{caseFile.location || "Location under review"}</span><span><Clock3 size={14}/>{caseFile.incidentDate || "Date under review"}{caseFile.incidentTime ? ` · ${caseFile.incidentTime}` : ""}</span><span><Users size={14}/>{suspects.length} people of interest</span><span><FileText size={14}/>{evidence.length} exhibits</span></div>
    <div className="investigation-layout">
      <aside className="case-nav-panel">
        <div className="case-objective"><span className="panel-kicker">INVESTIGATION OBJECTIVE</span><p>{caseFile.investigationObjective || "Establish what happened and identify the person whose account does not fit the evidence."}</p></div>
        <div className="panel-divider"/><span className="panel-kicker nav-kicker">CASE FILE</span>
        <nav className="case-section-nav" aria-label="Case file sections">{sections.map(({ key, label, icon: Icon }) => <button type="button" key={key} className={section === key ? "case-nav-item active" : "case-nav-item"} onClick={() => selectSection(key)}><Icon size={16}/><span>{label}</span>{key === "evidence" && <i>{evidence.length}</i>}</button>)}</nav>
        <div className="panel-divider"/><span className="panel-kicker nav-kicker">PEOPLE OF INTEREST <i>{suspects.length}</i></span>
        <div className="nav-suspects">{suspects.map((suspect, index) => <button type="button" key={suspect.suspectId} className="nav-suspect" onClick={() => openSuspect(suspect)}><span className={`suspect-initial suspect-color-${index % 5}`}>{suspect.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span><b>{suspect.fullName}</b><small>{suspect.occupation}</small></span><ChevronRight size={14}/></button>)}</div>
        <div className="case-nav-foot"><LockKeyhole size={13}/> YOUR CASE FILE IS PRIVATE</div>
      </aside>
      <main className="case-content-panel">
        {section === "overview" && <OverviewSection caseFile={caseFile} suspects={suspects} evidence={evidence} onSuspect={openSuspect} onSection={selectSection} onEvidence={openEvidence}/>}
        {section === "evidence" && <EvidenceSection evidence={filteredEvidence} allEvidence={evidence} category={category} onCategory={setCategory} query={query} onQuery={setQuery} bookmarked={investigation.markedEvidence} onOpen={openEvidence} onBookmark={toggleBookmark} readOnly={readOnly}/>}
        {section === "board" && <EvidenceBoard evidence={evidence} suspects={suspects} discoveredEvidenceIds={investigation.examinedEvidenceIds} investigatedSuspectIds={investigation.investigatedSuspectIds} board={board} onChange={setBoard} readOnly={readOnly} saving={boardSaving}/>}
        {section === "timeline" && <TimelineSection evidence={timelineEvidence} suspects={suspects} category={timelineCategory} onCategory={setTimelineCategory} suspectId={timelineSuspect} onSuspect={setTimelineSuspect} onOpen={openEvidence}/>}
        {section === "notes" && <NotesSection notes={noteDraft} onChange={setNoteDraft} onSave={saveNotes} saving={noteSaving} submitted={readOnly}/>}
        {section === "journal" && <DetectiveJournal entries={journalEntries} evidence={examinedEvidence} suspects={reviewedSuspects} saving={journalSaving} submitted={readOnly} onChange={setJournalEntries} onAdd={addJournalEntry} onDelete={deleteJournalEntry}/>}
      </main>
      <aside className="investigation-right">
        <div className="right-panel-head"><span className="panel-kicker">YOUR INVESTIGATION</span><span className="live-dot">â— {readOnly ? "CLOSED" : "ACTIVE"}</span></div>
        <div className="investigation-progress"><div className="progress-ring"><span>{investigation.progress}<small>%</small></span></div><div><b>Case progress</b><small>{investigation.progress ? "Your review activity" : "Start examining the file"}</small></div></div>
        <div className="right-divider"/>
        <div className="right-stat-row"><span>EXHIBITS EXAMINED</span><b>{investigation.examinedEvidenceIds.length}<small> / {evidence.length}</small></b></div>
        <div className="right-stat-row"><span>PEOPLE REVIEWED</span><b>{investigation.investigatedSuspectIds.length}<small> / {suspects.length}</small></b></div>
        <div className="right-stat-row"><span>CLUES YOU FLAGGED</span><b>{investigation.markedEvidence.length}<small> / {evidence.length}</small></b></div>
        <div className="right-stat-row"><span>TIMELINE</span><b className="timeline-review-state">{investigation.timelineReviewed ? "REVIEWED" : "NOT YET"}</b></div>
        <div className="right-divider"/>
        <div className="confidence-head"><div><span className="panel-kicker">YOUR READ ON THE SUSPECTS</span><small>Set your own confidence; this gives no signal about the answer.</small></div><span>{confidenceSaving ? "SAVING" : "SAVED"}</span></div>
        <div className="confidence-list">{suspects.map((suspect) => { const value = confidenceRatings.find((rating) => rating.suspectId === suspect.suspectId)?.confidence ?? 50; return <label className="confidence-row" key={suspect.suspectId}><span><b>{suspect.fullName}</b><small>{value}% confidence</small></span><input type="range" min={0} max={100} step={5} value={value} disabled={readOnly} aria-label={`Your confidence in ${suspect.fullName}`} onChange={(event) => updateConfidence(suspect.suspectId, Number(event.target.value))}/></label>; })}</div>
        <div className="right-divider"/>
        <div className="important-list-head"><span className="panel-kicker">YOUR KEY EXHIBITS</span><button type="button" onClick={() => selectSection("evidence")}>View all</button></div>
        {investigation.markedEvidence.length ? <div className="important-evidence-list">{investigation.markedEvidence.slice(0, 3).map((id) => { const item = evidence.find((entry) => entry.evidenceId === id); return item ? <button type="button" key={id} onClick={() => openEvidence(item)}><Bookmark size={13} fill="currentColor"/><span>{item.title}</span></button> : null; })}</div> : <p className="no-key-evidence">Mark exhibits important to keep them close while you investigate.</p>}
        <div className="right-divider"/>
        <div className="accuse-nudge"><span className="nudge-icon"><Scale size={17}/></span><b>{readOnly ? "Case closed." : "Ready to make your call?"}</b><p>{readOnly ? "Your accusation and final score are ready to review." : "Choose one suspect and present the evidence that supports your theory."}</p>{readOnly ? <Link className="button button-gold accuse-button" to={`/cases/${caseId}/result`}>View verdict <ArrowRight size={15}/></Link> : <button type="button" className="button button-gold accuse-button" onClick={() => setAccusationOpen(true)}>Make an accusation <ArrowRight size={15}/></button>}<small>{readOnly ? "FINAL VERDICT" : "FINAL · CANNOT BE CHANGED"}</small></div>
        <div className="fiction-note"><ShieldCheck size={14}/><span>Case materials are fictional. Progress and confidence reflect only your own investigation.</span></div>
      </aside>
    </div>
    {selectedEvidence && <EvidenceModal evidence={selectedEvidence} bookmarked={investigation.markedEvidence.includes(selectedEvidence.evidenceId)} readOnly={readOnly} onBookmark={() => void toggleBookmark(selectedEvidence)} onClose={() => setSelectedEvidence(null)}/>}
    {selectedSuspect && <SuspectModal suspect={selectedSuspect} onClose={() => setSelectedSuspect(null)}/>}
    {accusationOpen && <AccusationModal suspects={suspects} evidence={evidence} suspectId={accuseSuspect} onSuspect={setAccuseSuspect} explanation={explanation} onExplanation={setExplanation} selectedEvidence={supportingEvidence} onSelectedEvidence={setSupportingEvidence} error={accuseError} submitting={submitting} onSubmit={submitAccusation} onClose={() => setAccusationOpen(false)}/>}
  </div>;
}
function OverviewSection({caseFile,suspects,evidence,onSuspect,onSection,onEvidence}:{caseFile:PublicCase;suspects:PublicSuspect[];evidence:PublicEvidence[];onSuspect:(item:PublicSuspect)=>void;onSection:(s:Section)=>void;onEvidence:(e:PublicEvidence)=>void}){
  return <div className="content-section overview-section"><div className="content-heading"><div><span className="section-kicker">THE BRIEFING</span><h2>Start with what we know.</h2><p>Review the incident, then get to know the people who were there.</p></div><span className="briefing-mark">01 / 04</span></div><div className="incident-brief"><div className="incident-brief-label"><Siren size={15}/><span>INCIDENT SUMMARY</span><span className="incident-class">FICTIONAL CASE</span></div><h3>{caseFile.incident?.subject||"The incident"}</h3><p>{caseFile.incident?.summary||caseFile.description}</p><div className="incident-location"><span><MapPin size={13}/>{caseFile.location}</span><span><Clock3 size={13}/>{caseFile.incidentDate} · {caseFile.incidentTime}</span></div></div><div className="content-subhead"><div><span className="section-kicker">PEOPLE OF INTEREST</span><h3>Everyone has a story.</h3></div><span>{suspects.length} profiles <ChevronRight size={13}/></span></div><div className="suspect-grid">{suspects.map((suspect,index)=><button type="button" key={suspect.suspectId} className="suspect-card" onClick={()=>onSuspect(suspect)}><div className={`suspect-art suspect-color-${index%5}`}>{suspect.profileImage?<img className="suspect-photo" src={suspect.profileImage} alt={`Fictional portrait of ${suspect.fullName}`} loading="lazy"/>:<div className="suspect-silhouette"><span>{suspect.fullName.split(" ").map((p)=>p[0]).slice(0,2).join("")}</span></div>}<span className="suspect-card-index">PERSON OF INTEREST · 0{index+1}</span><span className="suspect-view"><ArrowRight size={13}/></span></div><div className="suspect-card-info"><b>{suspect.fullName}</b><span>{suspect.occupation}</span><small>{suspect.relationship}</small></div></button>)}</div><div className="overview-lower"><div className="overview-mini-card"><div className="mini-card-head"><div><span className="section-kicker">THE TRAIL</span><h3>Evidence, at a glance</h3></div><button type="button" onClick={()=>onSection("evidence")}>Open board <ArrowRight size={13}/></button></div><div className="mini-evidence-list">{evidence.slice(0,3).map((item)=><button type="button" key={item.evidenceId} onClick={()=>onEvidence(item)}><span className="mini-evidence-icon">{(() => {const Icon=iconForCategory[item.category]||FileText;return <Icon size={14}/>})()}</span><span><b>{item.title}</b><small>{categoryName[item.category]} · {item.timestamp}</small></span><ChevronRight size={14}/></button>)}</div></div><div className="overview-mini-card timeline-mini"><div className="mini-card-head"><div><span className="section-kicker">CHRONOLOGY</span><h3>Follow the timeline</h3></div><button type="button" onClick={()=>onSection("timeline")}>View timeline <ArrowRight size={13}/></button></div><p>Compare when things happened with what people say they did.</p><button type="button" className="timeline-mini-cta" onClick={()=>onSection("timeline")}><Clock3 size={15}/> Open case timeline <ArrowRight size={14}/></button></div></div></div>;
}

function EvidenceSection({evidence,allEvidence,category,onCategory,query,onQuery,bookmarked,onOpen,onBookmark,readOnly}:{evidence:PublicEvidence[];allEvidence:PublicEvidence[];category:string;onCategory:(category:string)=>void;query:string;onQuery:(query:string)=>void;bookmarked:string[];onOpen:(e:PublicEvidence)=>void;onBookmark:(e:PublicEvidence)=>void;readOnly:boolean}){
  return <div className="content-section evidence-section-main"><div className="content-heading"><div><span className="section-kicker">EVIDENCE BOARD</span><h2>Read between the lines.</h2><p>Each exhibit is a piece of the story. Some matter more than they first appear.</p></div><span className="exhibit-count">{allEvidence.length.toString().padStart(2,"0")} EXHIBITS</span></div><div className="evidence-toolbar"><div className="evidence-search"><Search size={15}/><input aria-label="Search all exhibits" value={query} onChange={(e)=>onQuery(e.target.value)} placeholder="Search all exhibits"/></div><div className="evidence-count-label"><Filter size={13}/> {evidence.length} results</div></div><div className="evidence-filter-row">{categories.map(({key,label,icon:Icon})=><button type="button" key={key} onClick={()=>onCategory(key)} className={category===key?"filter-chip selected":"filter-chip"}><Icon size={13}/>{label}{key==="ALL"&&<small>{allEvidence.length}</small>}</button>)}</div>{evidence.length?<div className="evidence-grid">{evidence.map((item,index)=><EvidenceCard key={item.evidenceId} item={item} index={index} bookmarked={bookmarked.includes(item.evidenceId)} onOpen={()=>onOpen(item)} onBookmark={()=>onBookmark(item)} readOnly={readOnly}/>)}</div>:<div className="empty-evidence"><Search size={20}/><b>No evidence matches this view.</b><span>Adjust the filter or search term.</span></div>}</div>;
}

function EvidenceCard({item,index,bookmarked,onOpen,onBookmark,readOnly}:{item:PublicEvidence;index:number;bookmarked:boolean;onOpen:()=>void;onBookmark:()=>void;readOnly:boolean}){
  const Icon=iconForCategory[item.category]||FileText;
  return <article className={`evidence-card exhibit-${item.category.toLowerCase()}`} style={{animationDelay:`${index*35}ms`}}><button type="button" className="evidence-card-main" onClick={onOpen}><div className="evidence-card-graphic"><div className="graphic-noise"/><span className="evidence-ref">EXHIBIT · {item.evidenceId.toUpperCase()}</span>{item.mediaUrl?<img className="evidence-photo" src={item.mediaUrl} alt={item.description} loading="lazy"/>:<span className="graphic-icon"><Icon size={22}/></span>}{item.category==="CCTV"&&<span className="simulated-tag">SIMULATED FRAME</span>}{item.category==="IMAGE"&&item.isSimulatedMedia&&<span className="simulated-tag">SIMULATED PHOTO</span>}{item.category==="IMAGE"&&!item.mediaUrl&&<span className="image-outline"/>}</div><div className="evidence-card-body"><span className="evidence-type"><Icon size={12}/>{categoryName[item.category]}</span><h3>{item.title}</h3><p>{item.description}</p><div className="evidence-card-meta"><span><Clock3 size={12}/>{item.timestamp}</span><span className={`reliability rel-${item.reliability.toLowerCase()}`}>{item.reliability} RELIABILITY</span></div></div></button><button type="button" className={bookmarked?"bookmark-button bookmarked":"bookmark-button"} disabled={readOnly} onClick={onBookmark} aria-label={bookmarked?"Unmark evidence":"Mark evidence important"}><Bookmark size={15} fill={bookmarked?"currentColor":"none"}/></button></article>;
}

function TimelineSection({ evidence, suspects, category, onCategory, suspectId, onSuspect, onOpen }:
  { evidence: PublicEvidence[]; suspects: PublicSuspect[]; category: string; onCategory: (value: string) => void; suspectId: string; onSuspect: (value: string) => void; onOpen: (evidence: PublicEvidence) => void }) {
  return <div className="content-section timeline-section">
    <div className="content-heading"><div><span className="section-kicker">CHRONOLOGY</span><h2>What happened when?</h2><p>Compare exhibit times with the accounts of the people involved.</p></div><span className="briefing-mark">{evidence.length.toString().padStart(2, "0")} ENTRIES</span></div>
    <div className="timeline-filters"><label>EXHIBIT CATEGORY<select value={category} onChange={(event) => onCategory(event.target.value)}>{categories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label>PEOPLE OF INTEREST<select value={suspectId} onChange={(event) => onSuspect(event.target.value)}><option value="ALL">All people</option>{suspects.map((suspect) => <option key={suspect.suspectId} value={suspect.suspectId}>{suspect.fullName}</option>)}</select></label><span>{evidence.length} matching events</span></div>
    <div className="timeline-date-label"><span/> CASE EVIDENCE · ORDERED BY TIME <span/></div>
    {evidence.length ? <div className="timeline-list">{evidence.map((item) => { const Icon = iconForCategory[item.category] || FileText; return <button type="button" className="timeline-entry" key={item.evidenceId} onClick={() => onOpen(item)}><span className="timeline-time">{item.timestamp}</span><span className="timeline-marker"><Icon size={13}/></span><span className="timeline-entry-card"><span className="timeline-entry-category">{categoryName[item.category]} · {item.source}</span><b>{item.title}</b><small>{item.description}</small><span className="timeline-open">Open exhibit <ArrowRight size={12}/></span></span></button>; })}</div> : <div className="empty-evidence"><Clock3 size={19}/><b>No events match these filters.</b><span>Choose another suspect or exhibit category.</span></div>}
    <div className="timeline-tip"><AlertTriangle size={15}/><span>A timestamp tells you when something was recorded. It doesn't always tell you when it happened.</span></div>
  </div>;
}

function NotesSection({ notes, onChange, onSave, saving, submitted }:
  { notes: string; onChange: (value: string) => void; onSave: () => void; saving: boolean; submitted: boolean }) {
  return <div className="content-section notes-section">
    <div className="content-heading"><div><span className="section-kicker">PRIVATE FIELD NOTES</span><h2>Make sense of the details.</h2><p>Use this scratchpad for quick observations. Your longer theories belong in the detective journal.</p></div><span className="notes-lock"><LockKeyhole size={14}/> PRIVATE</span></div>
    <div className="notebook"><div className="notebook-top"><span><NotebookPen size={15}/> INVESTIGATION SCRATCHPAD</span><span>{notes.length.toLocaleString()} / 12,000</span></div><textarea value={notes} onChange={(event) => onChange(event.target.value)} maxLength={12000} disabled={submitted} placeholder={"Start with the questions.\n\n• Whose account conflicts with an exhibit?\n• What detail seems out of place?\n• Which people or exhibits might be connected?"}/><div className="notebook-bottom"><span><LockKeyhole size={12}/> {submitted ? "Saved with this completed case" : saving ? "Saving automatically…" : "Autosaved to this investigation"}</span><button type="button" onClick={onSave} disabled={saving || submitted}>{submitted ? "Read only" : saving ? "Saving…" : "Save now"}<Check size={13}/></button></div></div>
    <div className="note-prompts"><span className="section-kicker">QUESTIONS TO CONSIDER</span><div><span>01</span>Who had the opportunity?</div><div><span>02</span>Which detail challenges an alibi?</div><div><span>03</span>What evidence would you show in court?</div></div>
  </div>;
}
function EvidenceModal({evidence,bookmarked,onBookmark,onClose,readOnly}:{evidence:PublicEvidence;bookmarked:boolean;onBookmark:()=>void;onClose:()=>void;readOnly:boolean}){
  const Icon=iconForCategory[evidence.category]||FileText;
  return <div className="modal-backdrop" role="presentation"><button type="button" className="modal-backdrop-dismiss" onClick={onClose} aria-label="Close exhibit details"/><section className="evidence-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-title"><div className="modal-topline"><span><Icon size={14}/>{categoryName[evidence.category]} · EXHIBIT {evidence.evidenceId.toUpperCase()}</span><button type="button" className="icon-button" onClick={onClose} aria-label="Close exhibit"><X size={18}/></button></div><div className={`evidence-modal-art exhibit-${evidence.category.toLowerCase()}`}>{evidence.mediaUrl?<img className="evidence-photo" src={evidence.mediaUrl} alt={evidence.description}/>:<><div className="graphic-noise"/><Icon size={34}/></>}{evidence.isSimulatedMedia&&<span className="simulated-tag">SIMULATED FICTIONAL MEDIA</span>}</div><h2 id="evidence-title">{evidence.title}</h2><p className="modal-description">{evidence.description}</p><div className="modal-meta-grid"><div><small>RECORDED</small><b>{evidence.timestamp}</b></div><div><small>SOURCE</small><b>{evidence.source}</b></div><div><small>RELIABILITY</small><b>{evidence.reliability}</b></div></div><div className="evidence-transcript"><span className="section-kicker">EXHIBIT CONTENT</span><p>{evidence.content}</p>{evidence.observations.length>0&&<ul>{evidence.observations.map((observation)=> <li key={observation}>{observation}</li>)}</ul>}</div><div className="discoverable-clue"><span>DETAIL TO CONSIDER</span><p>{evidence.clueText}</p></div><div className="modal-footer"><span><ShieldCheck size={13}/> Fictional case artifact</span><button type="button" className={bookmarked?"button button-marked":"button button-quiet"} onClick={onBookmark} disabled={readOnly}><Bookmark size={14} fill={bookmarked?"currentColor":"none"}/>{readOnly?"Read-only file":bookmarked?"Marked important":"Mark important"}</button></div></section></div>;
}

function SuspectModal({suspect,onClose}:{suspect:PublicSuspect;onClose:()=>void}){
  const index=Math.abs(suspect.fullName.charCodeAt(0))%5;
  return <div className="modal-backdrop" role="presentation"><button type="button" className="modal-backdrop-dismiss" onClick={onClose} aria-label="Close suspect profile"/><section className="suspect-modal" role="dialog" aria-modal="true" aria-labelledby="suspect-title"><button type="button" className="icon-button suspect-modal-close" onClick={onClose} aria-label="Close profile"><X size={18}/></button><div className={`suspect-modal-art suspect-color-${index}`}>{suspect.profileImage?<img className="suspect-photo" src={suspect.profileImage} alt={`Fictional portrait of ${suspect.fullName}`}/>:<div className="suspect-silhouette"><span>{suspect.fullName.split(" ").map((p)=>p[0]).slice(0,2).join("")}</span></div>}<span>PERSON OF INTEREST · {suspect.suspectId.toUpperCase()}</span></div><div className="suspect-modal-content"><span className="section-kicker">PROFILE FILE</span><h2 id="suspect-title">{suspect.fullName}</h2><p className="suspect-role">{suspect.age} · {suspect.occupation}</p><div className="suspect-relation"><Users size={14}/>{suspect.relationship}</div><div className="suspect-profile-block"><small>BACKGROUND</small><p>{suspect.background}</p></div><div className="suspect-profile-block"><small>KNOWN MOTIVE</small><p>{suspect.publicMotive}</p></div><div className="suspect-profile-block"><small>STATED ALIBI</small><p>{suspect.publicAlibi}</p></div><div className="suspect-profile-block"><small>OBSERVED PERSONALITY</small><p>{suspect.personality}</p></div><div className="profile-footnote"><ShieldCheck size={13}/> Profile information is limited to what is currently discoverable.</div><button type="button" className="button button-quiet suspect-done" onClick={onClose}>Return to case</button></div></section></div>;
}

function AccusationModal({suspects,evidence,suspectId,onSuspect,explanation,onExplanation,selectedEvidence,onSelectedEvidence,error,submitting,onSubmit,onClose}:{suspects:PublicSuspect[];evidence:PublicEvidence[];suspectId:string;onSuspect:(id:string)=>void;explanation:string;onExplanation:(text:string)=>void;selectedEvidence:string[];onSelectedEvidence:(ids:string[])=>void;error:string;submitting:boolean;onSubmit:(event:FormEvent)=>void;onClose:()=>void}){
  const [confirmed,setConfirmed]=useState(false);
  function toggle(id:string){onSelectedEvidence(selectedEvidence.includes(id)?selectedEvidence.filter((item)=>item!==id):[...selectedEvidence,id]);}
  return <div className="modal-backdrop accusation-backdrop" role="presentation"><button type="button" className="modal-backdrop-dismiss" onClick={onClose} aria-label="Close accusation dialog"/><section className="accusation-modal" role="dialog" aria-modal="true" aria-labelledby="accusation-title"><div className="accusation-head"><div><span className="section-kicker">FINAL ACCUSATION · CASE MR</span><h2 id="accusation-title">Who did it?</h2><p>This is your final call. Once submitted, the solution will be revealed.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close accusation"><X size={18}/></button></div><form onSubmit={onSubmit}><div className="accusation-label">SELECT ONE SUSPECT</div><div className="accusation-suspects">{suspects.map((suspect,index)=><button type="button" key={suspect.suspectId} onClick={()=>onSuspect(suspect.suspectId)} className={suspectId===suspect.suspectId?"accusation-suspect chosen":"accusation-suspect"}><span className={`suspect-initial suspect-color-${index%5}`}>{suspect.fullName.split(" ").map((p)=>p[0]).slice(0,2).join("")}</span><span><b>{suspect.fullName}</b><small>{suspect.occupation}</small></span><span className="radio-dot"/></button>)}</div><label htmlFor="accusation-explanation" className="accusation-label explanation-label">YOUR THEORY <small>OPTIONAL</small></label><textarea id="accusation-explanation" className="accusation-textarea" maxLength={3000} value={explanation} onChange={(e)=>onExplanation(e.target.value)} placeholder="Explain the motive, the opportunity, and what the evidence tells you…"/><div className="accusation-label evidence-label">SUPPORTING EVIDENCE <small>OPTIONAL · {selectedEvidence.length} SELECTED</small></div><div className="supporting-evidence-list">{evidence.map((item)=> <label key={item.evidenceId} className="support-evidence"><input type="checkbox" checked={selectedEvidence.includes(item.evidenceId)} onChange={()=>toggle(item.evidenceId)}/><span><b>{item.title}</b><small>{categoryName[item.category]} · {item.timestamp}</small></span><Check size={14}/></label>)}</div><div className="scoring-guide"><span>SCORING GUIDE</span><p>Suspect <b>50</b> · Motive <b>20</b> · Critical clues <b>20</b> · Timeline <b>10</b></p></div>{error&&<div className="form-alert">{error}</div>}<label className="confirm-final"><input type="checkbox" checked={confirmed} onChange={(e)=>setConfirmed(e.target.checked)}/><span>I understand this is my final accusation and the solution will be revealed.</span></label><div className="accusation-submit-row"><button type="button" className="button button-quiet" onClick={onClose}>Keep investigating</button><button type="submit" className="button button-gold" disabled={!confirmed||submitting}>{submitting?"Submitting…":"Submit accusation"}<Gavel size={15}/></button></div></form></section></div>;
}
