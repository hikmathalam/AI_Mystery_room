import { BookOpen, Plus, Save, Trash2 } from "lucide-react";
import type { JournalEntry, PublicEvidence, PublicSuspect } from "@mystery-room/shared";

const types: Array<{ value: JournalEntry["type"]; label: string }> = [
  { value: "NOTE", label: "Field note" },
  { value: "THEORY", label: "Theory" },
  { value: "MOTIVE", label: "Possible motive" },
  { value: "CONTRADICTION", label: "Contradiction" },
  { value: "DISCOVERY", label: "Discovery" },
  { value: "OBSERVATION", label: "Observation" }
];

export function DetectiveJournal({ entries, evidence, suspects, saving, submitted, onChange, onAdd, onDelete }:
  { entries: JournalEntry[]; evidence: PublicEvidence[]; suspects: PublicSuspect[]; saving: boolean; submitted: boolean; onChange: (entries: JournalEntry[]) => void; onAdd: () => void; onDelete: (id: string) => void }) {
  const active = entries[0];
  function update(patch: Partial<JournalEntry>) {
    if (!active) return;
    onChange(entries.map((entry) => entry.id === active.id ? { ...entry, ...patch } : entry));
  }
  function toggleReference(kind: "evidenceIds" | "suspectIds", id: string) {
    if (!active) return;
    const values = active[kind];
    update({ [kind]: values.includes(id) ? values.filter((item) => item !== id) : [...values, id] });
  }
  return <div className="content-section journal-section">
    <div className="content-heading"><div><span className="section-kicker">PRIVATE DETECTIVE JOURNAL</span><h2>Keep your reasoning together.</h2><p>Record a theory, contradiction, motive, discovery, or field observation. Entries save automatically.</p></div><span className={`journal-save-state ${saving ? "is-saving" : ""}`}><Save size={13}/>{submitted ? "READ ONLY" : saving ? "SAVING" : "AUTOSAVED"}</span></div>
    <div className="journal-workspace"><aside className="journal-entry-list"><div className="journal-list-heading"><span>{entries.length} / 50 ENTRIES</span><button type="button" className="button button-quiet button-small" onClick={onAdd} disabled={submitted || entries.length >= 50}><Plus size={13}/> New entry</button></div>
      {entries.length ? entries.map((entry) => <button type="button" key={entry.id} className={`journal-entry-tab ${active?.id === entry.id ? "active" : ""}`} onClick={() => onChange([entry, ...entries.filter((item) => item.id !== entry.id)])}><span>{types.find((type) => type.value === entry.type)?.label}</span><b>{entry.title || "Untitled entry"}</b><small>{entry.content.slice(0, 68) || "No details yet"}</small></button>) : <div className="journal-list-empty"><BookOpen size={18}/><span>Your journal is empty.</span><small>Create an entry to start a theory.</small></div>}
    </aside>
    <div className="journal-editor">{active ? <>
      <div className="journal-editor-toolbar"><label>ENTRY TYPE<select value={active.type} onChange={(event) => update({ type: event.target.value as JournalEntry["type"] })} disabled={submitted}>{types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><button type="button" className="icon-button journal-delete" onClick={() => onDelete(active.id)} disabled={submitted} aria-label="Delete journal entry"><Trash2 size={15}/></button></div>
      <label className="journal-title-label">ENTRY TITLE<input value={active.title} onChange={(event) => update({ title: event.target.value })} maxLength={120} disabled={submitted} placeholder="A detail worth remembering"/></label>
      <label className="journal-content-label">YOUR NOTES<textarea value={active.content} onChange={(event) => update({ content: event.target.value })} maxLength={4000} disabled={submitted} placeholder="Write down what you noticed and why it matters…"/><small>{active.content.length.toLocaleString()} / 4,000</small></label>
      <div className="journal-reference-grid"><fieldset><legend>LINK DISCOVERED EXHIBITS</legend>{evidence.map((item) => <label key={item.evidenceId}><input type="checkbox" checked={active.evidenceIds.includes(item.evidenceId)} onChange={() => toggleReference("evidenceIds", item.evidenceId)} disabled={submitted}/><span>{item.title}</span></label>)}</fieldset><fieldset><legend>LINK REVIEWED PEOPLE</legend>{suspects.map((suspect) => <label key={suspect.suspectId}><input type="checkbox" checked={active.suspectIds.includes(suspect.suspectId)} onChange={() => toggleReference("suspectIds", suspect.suspectId)} disabled={submitted}/><span>{suspect.fullName}</span></label>)}</fieldset></div>
      <div className="journal-editor-footer"><span>PRIVATE TO THIS INVESTIGATION</span><span>{saving ? "Saving changes…" : "Changes save automatically"}</span></div>
    </> : <div className="journal-empty"><BookOpen size={24}/><h3>Start your case journal.</h3><p>Record what you notice, then connect it to the exhibits and people you have reviewed.</p><button type="button" className="button button-gold" onClick={onAdd} disabled={submitted}><Plus size={14}/> Create first entry</button></div>}</div></div>
  </div>;
}
