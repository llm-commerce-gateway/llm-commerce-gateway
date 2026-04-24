/**
 * Loop action + query tool primitives for Gateway Console MCP handlers.
 * This module is framework-agnostic so tests can run in plain node --test.
 */

function buildAiActor(session) {
  return {
    type: "ai-agent",
    actorId: `agent:commerce-gateway/${session.agentId}`,
    agentId: session.agentId,
    gatewaySessionId: session.sessionId,
    orgId: session.orgId,
  };
}

function buildActorEvidence(actor, base = {}) {
  return {
    ...base,
    actor_type: actor.type,
    actor_id: actor.actorId,
    ...(actor.type === "ai-agent" ? { ai_agent_id: actor.agentId } : {}),
  };
}

function canActorExecuteTransition(actor, transition, definition) {
  const target = definition.transitions.find((entry) => entry.id === transition);
  if (!target) {
    return { authorized: false, reason: "invalid_transition" };
  }
  if (!target.allowedActors.includes(actor.type)) {
    return {
      authorized: false,
      reason: actor.type === "ai-agent" ? "human_approval_required" : "unauthorized_actor",
      requiresApproval: actor.type === "ai-agent",
    };
  }
  return { authorized: true };
}

export async function loopSubmitAction(input, context) {
  const actor = buildAiActor(context.session);
  const submission = {
    actor,
    loopId: input.loopId,
    aggregateId: input.aggregateId,
    recommendedTransition: input.transitionId,
    confidence: input.confidence,
    reasoning: input.reasoning,
    evidence: input.evidence ?? {},
  };

  const definition = context.loopRegistry.get(input.loopId);
  if (!definition) {
    return { status: "rejected", reason: `Loop ${input.loopId} not found` };
  }

  const authResult = canActorExecuteTransition(actor, input.transitionId, definition);
  if (!authResult.authorized && !authResult.requiresApproval) {
    return { status: "rejected", rejectionReason: authResult.reason };
  }

  const enrichedEvidence = buildActorEvidence(actor, {
    ...submission.evidence,
    ai_confidence: submission.confidence,
    ai_reasoning: submission.reasoning,
  });

  if (authResult.requiresApproval) {
    return {
      status: "pending_approval",
      requiresApprovalFrom: "human-approver",
      evidence: enrichedEvidence,
    };
  }

  const result = await context.loopEngineService.transition({
    aggregateId: input.aggregateId,
    transitionId: input.transitionId,
    actor,
    evidence: enrichedEvidence,
    correlationId: context.session.correlationId,
  });

  return {
    status: result.status,
    fromState: result.fromState,
    toState: result.toState,
    requiresApprovalFrom: result.requiresApprovalFrom,
    guardFailures: result.guardFailures,
    rejectionReason: result.rejectionReason,
    evidence: enrichedEvidence,
  };
}

export async function loopGetState(input, context) {
  const state = await context.loopEngineService.getState(input.aggregateId);
  const definition = context.loopRegistry.get(state.loopId);
  const availableTransitions = (definition?.transitions ?? []).filter(
    (transition) => transition.from === state.currentState
  );

  return {
    loopId: state.loopId,
    aggregateId: state.aggregateId,
    currentState: state.currentState,
    status: state.status,
    startedAt: state.startedAt,
    closedAt: state.closedAt ?? null,
    availableTransitions,
    recentHistory: input.includeHistory === false ? [] : (state.history ?? []).slice(-10).map((entry) => ({
      from: entry.fromState,
      to: entry.toState,
      actor: { type: entry.actor?.type, id: entry.actor?.actorId },
      occurredAt: entry.occurredAt,
    })),
  };
}
