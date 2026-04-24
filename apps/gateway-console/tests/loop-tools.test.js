import test from "node:test";
import assert from "node:assert/strict";
import { loopGetState, loopSubmitAction } from "../src/loop-tools.js";

const baseSession = {
  agentId: "claude",
  sessionId: "gs-1",
  orgId: "org-1",
  correlationId: "corr-1",
};

const loopDefinition = {
  id: "scm.procurement",
  transitions: [
    { id: "close_procurement", from: "INVOICE_MATCHED", to: "CLOSED", allowedActors: ["ai-agent", "human"] },
    { id: "confirm_po", from: "OPEN", to: "PO_CONFIRMED", allowedActors: ["human"] },
  ],
};

function createLoopRegistry() {
  return {
    get(loopId) {
      return loopId === "scm.procurement" ? loopDefinition : undefined;
    },
  };
}

test("loop_submit_action executes when AI actor is allowed", async () => {
  const calls = [];
  const result = await loopSubmitAction(
    {
      loopId: "scm.procurement",
      aggregateId: "PO-1",
      transitionId: "close_procurement",
      confidence: 0.92,
      reasoning: "All guards pass",
    },
    {
      session: baseSession,
      loopRegistry: createLoopRegistry(),
      loopEngineService: {
        async transition(payload) {
          calls.push(payload);
          return { status: "executed", fromState: "INVOICE_MATCHED", toState: "CLOSED" };
        },
      },
    }
  );

  assert.equal(result.status, "executed");
  assert.equal(calls[0].evidence.actor_type, "ai-agent");
});

test("loop_submit_action rejects unknown loop", async () => {
  const result = await loopSubmitAction(
    {
      loopId: "missing.loop",
      aggregateId: "x",
      transitionId: "close_procurement",
      confidence: 0.9,
      reasoning: "x",
    },
    {
      session: baseSession,
      loopRegistry: { get: () => undefined },
      loopEngineService: {},
    }
  );
  assert.equal(result.status, "rejected");
});

test("loop_submit_action returns pending approval for human-only transition", async () => {
  const result = await loopSubmitAction(
    {
      loopId: "scm.procurement",
      aggregateId: "PO-2",
      transitionId: "confirm_po",
      confidence: 0.8,
      reasoning: "suggesting confirm",
    },
    {
      session: baseSession,
      loopRegistry: createLoopRegistry(),
      loopEngineService: { transition: async () => ({ status: "executed" }) },
    }
  );
  assert.equal(result.status, "pending_approval");
});

test("loop_submit_action evidence contains ai_confidence and ai_reasoning", async () => {
  const records = [];
  await loopSubmitAction(
    {
      loopId: "scm.procurement",
      aggregateId: "PO-3",
      transitionId: "close_procurement",
      confidence: 0.77,
      reasoning: "Based on invoice match",
    },
    {
      session: baseSession,
      loopRegistry: createLoopRegistry(),
      loopEngineService: {
        async transition(payload) {
          records.push(payload);
          return { status: "executed", fromState: "INVOICE_MATCHED", toState: "CLOSED" };
        },
      },
    }
  );
  assert.equal(records[0].evidence.ai_confidence, 0.77);
  assert.equal(records[0].evidence.ai_reasoning, "Based on invoice match");
});

test("loop_get_state returns current state and available transitions", async () => {
  const result = await loopGetState(
    { aggregateId: "PO-1", includeHistory: true },
    {
      loopRegistry: createLoopRegistry(),
      loopEngineService: {
        async getState() {
          return {
            loopId: "scm.procurement",
            aggregateId: "PO-1",
            currentState: "INVOICE_MATCHED",
            status: "OPEN",
            startedAt: "2026-03-09T00:00:00.000Z",
            closedAt: null,
            history: [],
          };
        },
      },
    }
  );
  assert.equal(result.currentState, "INVOICE_MATCHED");
  assert.equal(result.availableTransitions.length, 1);
});

test("loop_get_state returns closedAt for closed instance", async () => {
  const result = await loopGetState(
    { aggregateId: "PO-1", includeHistory: false },
    {
      loopRegistry: createLoopRegistry(),
      loopEngineService: {
        async getState() {
          return {
            loopId: "scm.procurement",
            aggregateId: "PO-1",
            currentState: "CLOSED",
            status: "CLOSED",
            startedAt: "2026-03-09T00:00:00.000Z",
            closedAt: "2026-03-10T00:00:00.000Z",
            history: [],
          };
        },
      },
    }
  );
  assert.equal(result.closedAt, "2026-03-10T00:00:00.000Z");
});
