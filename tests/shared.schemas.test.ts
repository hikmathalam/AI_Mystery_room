import { describe, expect, it } from "vitest";
import { boardSchema, caseCreationSchema, confidenceSchema, journalSchema } from "../shared/src/index.js";

describe("shared request schemas", () => {
  it("applies safe defaults and rejects a short scenario", () => {
    const valid = caseCreationSchema.parse({ scenario: "A detailed fictional case with a locked room and four people nearby." });
    expect(valid.suspectCount).toBe(4);
    expect(valid.difficulty).toBe("Medium");
    expect(() => caseCreationSchema.parse({ scenario: "Too short" })).toThrow();
  });

  it("accepts a board made from user discoveries and annotations", () => {
    const board = boardSchema.parse({
      nodes: [
        { id: "evidence:EX-1", kind: "evidence", entityId: "EX-1", label: "A receipt", x: 20, y: 40 },
        { id: "suspect:S-1", kind: "suspect", entityId: "S-1", label: "A. Detective", x: 330, y: 60 },
        { id: "annotation:note-1", kind: "annotation", label: "Theory", text: "The time may matter.", x: 160, y: 260 }
      ],
      edges: [{ id: "edge-1", source: "evidence:EX-1", target: "suspect:S-1", label: "possible link" }]
    });
    expect(board.nodes).toHaveLength(3);
    expect(board.edges[0].target).toBe("suspect:S-1");
  });

  it("rejects board links to missing nodes and blank annotations", () => {
    expect(() => boardSchema.parse({
      nodes: [{ id: "annotation:empty", kind: "annotation", label: "Theory", x: 0, y: 0 }], edges: []
    })).toThrow();
    expect(() => boardSchema.parse({
      nodes: [{ id: "evidence:1", kind: "evidence", entityId: "EX-1", label: "Receipt", x: 0, y: 0 }],
      edges: [{ id: "edge-1", source: "evidence:1", target: "missing" }]
    })).toThrow();
  });

  it("bounds confidence and keeps one rating per suspect", () => {
    expect(confidenceSchema.parse({ ratings: [{ suspectId: "S-1", confidence: 70 }] }).ratings[0].confidence).toBe(70);
    expect(() => confidenceSchema.parse({ ratings: [{ suspectId: "S-1", confidence: 120 }] })).toThrow();
    expect(() => confidenceSchema.parse({ ratings: [{ suspectId: "S-1", confidence: 30 }, { suspectId: "S-1", confidence: 80 }] })).toThrow();
  });

  it("limits journal entries and rejects duplicate entry IDs", () => {
    const entry = { id: "entry-1", type: "THEORY", title: "A theory", content: "The clock may have been changed.", evidenceIds: ["EX-1"], suspectIds: ["S-2"] };
    expect(journalSchema.parse({ entries: [entry] }).entries).toHaveLength(1);
    expect(() => journalSchema.parse({ entries: [entry, entry] })).toThrow();
  });
});
