import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge, Background, BackgroundVariant, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider,
  useEdgesState, useNodesState, useReactFlow, type Connection, type Edge, type Node, type NodeProps, type NodeTypes
} from "@xyflow/react";
import { FileText, Plus, StickyNote, Trash2, Users } from "lucide-react";
import type { InvestigationBoard, PublicEvidence, PublicSuspect } from "@mystery-room/shared";
import "@xyflow/react/dist/style.css";

type BoardFlowData = {
  kind: "evidence" | "suspect" | "annotation";
  label: string;
  subtitle: string;
  detail?: string;
  text?: string;
  onTextChange?: (id: string, value: string) => void;
};
type BoardFlowNode = Node<BoardFlowData, "case">;

function CaseBoardNode({ id, data }: NodeProps<BoardFlowNode>) {
  const Icon = data.kind === "suspect" ? Users : data.kind === "annotation" ? StickyNote : FileText;
  return <article className={`board-flow-card board-flow-${data.kind}`}>
    <Handle type="target" position={Position.Left}/>
    <span className="board-flow-kicker"><Icon size={12}/>{data.subtitle}</span>
    <b>{data.label}</b>
    {data.kind === "annotation" ? <textarea className="board-annotation-input nodrag nopan" value={data.text || ""} maxLength={2000} aria-label="Board annotation" onChange={(event) => data.onTextChange?.(id, event.target.value)}/> : <p>{data.detail}</p>}
    <span className="board-flow-foot">{data.kind === "annotation" ? "PRIVATE FIELD NOTE" : "DISCOVERED BY YOU"}</span>
    <Handle type="source" position={Position.Right}/>
  </article>;
}

const nodeTypes: NodeTypes = { case: CaseBoardNode };

function toFlowNode(node: InvestigationBoard["nodes"][number], evidence: PublicEvidence[], suspects: PublicSuspect[], onTextChange: BoardFlowData["onTextChange"]): BoardFlowNode {
  if (node.kind === "annotation") return {
    id: node.id, type: "case", position: { x: node.x, y: node.y }, data: {
      kind: "annotation", label: node.label, subtitle: "YOUR ANNOTATION", text: node.text, onTextChange
    }
  };
  if (node.kind === "evidence") {
    const item = evidence.find((candidate) => candidate.evidenceId === node.entityId);
    return {
      id: node.id, type: "case", position: { x: node.x, y: node.y }, data: {
        kind: "evidence", label: item?.title || node.label,
        subtitle: item ? `${item.category} · ${item.timestamp}` : "EXHIBIT",
        detail: item?.description || "Case exhibit"
      }
    };
  }
  const suspect = suspects.find((candidate) => candidate.suspectId === node.entityId);
  return {
    id: node.id, type: "case", position: { x: node.x, y: node.y }, data: {
      kind: "suspect", label: suspect?.fullName || node.label,
      subtitle: suspect?.occupation || "PERSON OF INTEREST",
      detail: suspect?.relationship || "Reviewed suspect"
    }
  };
}

function EvidenceBoardCanvas({ evidence, suspects, discoveredEvidenceIds, investigatedSuspectIds, board, onChange, readOnly, saving }:
  { evidence: PublicEvidence[]; suspects: PublicSuspect[]; discoveredEvidenceIds: string[]; investigatedSuspectIds: string[]; board: InvestigationBoard; onChange: (board: InvestigationBoard) => void; readOnly: boolean; saving: boolean }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [availableItem, setAvailableItem] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const initialBoard = useRef(board);
  const { fitView } = useReactFlow<BoardFlowNode, Edge>();
  const setAnnotationText = useCallback((id: string, text: string) => {
    setNodes((current) => current.map((node) => node.id === id ? { ...node, data: { ...node.data, text } } : node));
  }, [setNodes]);
  const available = useMemo(() => [
    ...evidence.filter((item) => discoveredEvidenceIds.includes(item.evidenceId) && !board.nodes.some((node) => node.kind === "evidence" && node.entityId === item.evidenceId)).map((item) => ({ id: `evidence:${item.evidenceId}`, label: `Exhibit · ${item.title}` })),
    ...suspects.filter((suspect) => investigatedSuspectIds.includes(suspect.suspectId) && !board.nodes.some((node) => node.kind === "suspect" && node.entityId === suspect.suspectId)).map((suspect) => ({ id: `suspect:${suspect.suspectId}`, label: `Person · ${suspect.fullName}` }))
  ], [board.nodes, discoveredEvidenceIds, evidence, investigatedSuspectIds, suspects]);

  useEffect(() => {
    setNodes(initialBoard.current.nodes.map((node) => toFlowNode(node, evidence, suspects, setAnnotationText)));
    setEdges(initialBoard.current.edges.map((edge) => ({ ...edge, type: "smoothstep", style: { stroke: "#d6a84f", strokeWidth: 2 }, label: edge.label || "possible link", labelStyle: { fill: "#c9b887", fontSize: 10 }, labelBgStyle: { fill: "#101827" } })));
    setHydrated(true);
  }, [evidence, setAnnotationText, setEdges, setNodes, suspects]);

  useEffect(() => {
    if (hydrated && nodes.length > 0) void fitView({ padding: 0.12, duration: 140 });
  }, [fitView, hydrated, nodes.length]);

  useEffect(() => {
    if (!hydrated) return;
    onChange({
      nodes: nodes.map((node) => ({ id: node.id, kind: node.data.kind, entityId: node.data.kind === "annotation" ? undefined : node.id.replace(/^(evidence|suspect):/, ""), label: node.data.label, ...(node.data.kind === "annotation" ? { text: node.data.text || "" } : {}), x: node.position.x, y: node.position.y })),
      edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: typeof edge.label === "string" ? edge.label : "possible link" }))
    });
  }, [hydrated, nodes, edges, onChange]);

  function addSelectedItem() {
    const [kind, entityId] = availableItem.split(":", 2);
    if (!entityId) return;
    const nodeId = `${kind}:${entityId}`;
    const node = kind === "evidence" ? evidence.find((item) => item.evidenceId === entityId) : suspects.find((item) => item.suspectId === entityId);
    if (!node) return;
    const item = kind === "evidence" ? { id: nodeId, kind: "evidence" as const, entityId, label: (node as PublicEvidence).title } : { id: nodeId, kind: "suspect" as const, entityId, label: (node as PublicSuspect).fullName };
    const savedNode = { ...item, x: 35, y: 45 + nodes.length * 205 };
    setNodes((current) => [...current, toFlowNode(savedNode, evidence, suspects, setAnnotationText)]);
    setAvailableItem("");
  }

  function addAnnotation() {
    const id = `annotation:${crypto.randomUUID()}`;
    const node = { id, kind: "annotation" as const, label: "Field note", text: "Write a theory or observation…", x: 35, y: 45 + nodes.length * 205 };
    setNodes((current) => [...current, toFlowNode(node, evidence, suspects, setAnnotationText)]);
  }

  const onConnect = useCallback((connection: Connection) => {
    if (readOnly) return;
    setEdges((current) => addEdge({ ...connection, id: crypto.randomUUID(), label: "possible link", type: "smoothstep", style: { stroke: "#d6a84f", strokeWidth: 2 }, labelStyle: { fill: "#c9b887", fontSize: 10 }, labelBgStyle: { fill: "#101827" } }, current));
  }, [readOnly, setEdges]);

  const selectedEdge = edges.some((edge) => edge.selected);
  const selectedNode = nodes.some((node) => node.selected);
  function removeSelection() {
    if (selectedEdge) setEdges((current) => current.filter((edge) => !edge.selected));
    else {
      const removed = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
      setNodes((current) => current.filter((node) => !removed.has(node.id)));
      setEdges((current) => current.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)));
    }
  }
  return <div className="content-section board-section"><div className="content-heading"><div><span className="section-kicker">DETECTIVE'S EVIDENCE BOARD</span><h2>Connect what you have found.</h2><p>Drag cards, connect two cards to test a theory, and add private annotations. Only items you have reviewed can be placed here.</p></div><span className="board-private"><Users size={13}/> YOUR THEORY <small>{saving ? "SAVING" : "SAVED"}</small></span></div>
    <div className="board-toolbar"><label><span>Add a discovered item</span><select value={availableItem} onChange={(event) => setAvailableItem(event.target.value)} disabled={readOnly || available.length === 0}><option value="">{available.length ? "Choose an exhibit or person" : "Review an exhibit or profile first"}</option>{available.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button type="button" className="button button-quiet" onClick={addSelectedItem} disabled={readOnly || !availableItem}><Plus size={14}/> Add card</button><button type="button" className="button button-quiet" onClick={addAnnotation} disabled={readOnly}><StickyNote size={14}/> Add annotation</button><button type="button" className="button button-quiet board-remove" onClick={removeSelection} disabled={readOnly || (!selectedEdge && !selectedNode)}><Trash2 size={14}/> Remove selected</button></div>
    <div className="board-canvas-wrap"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodesDraggable={!readOnly} nodesConnectable={!readOnly} elementsSelectable={!readOnly} deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]} fitView fitViewOptions={{ padding: 0.25 }} minZoom={0.35} maxZoom={1.6} panOnScroll proOptions={{ hideAttribution: false }}>
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#334155"/><Controls showInteractive={false}/><MiniMap pannable zoomable nodeColor={(node) => node.data.kind === "suspect" ? "#8ca7c8" : node.data.kind === "annotation" ? "#d6a84f" : "#31455f"}/>
    </ReactFlow>{nodes.length === 0&&<div className="board-empty"><span><FileText size={20}/></span><b>Your board is ready for discoveries.</b><p>Open evidence and suspect profiles first, then add them here to build your own theory.</p></div>}</div>
    <div className="board-legend"><span><i className="legend-evidence"/>Exhibit</span><span><i className="legend-suspect"/>Person of interest</span><span><i className="legend-note"/>Your annotation</span><small>Connections are your own hypotheses; they do not reflect hidden case answers.</small></div>
  </div>;
}

export function EvidenceBoard(props: Parameters<typeof EvidenceBoardCanvas>[0]) {
  return <ReactFlowProvider><EvidenceBoardCanvas {...props}/></ReactFlowProvider>;
}
