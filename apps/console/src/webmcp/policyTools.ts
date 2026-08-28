import { TRUST, type OriginName } from "@airlock/shared";
import { modelContext } from "./types";
import type { Ledger } from "../state/ledger";

/**
 * Tools the console publishes about its own decisions.
 *
 * Every other tool here is a proxy for something a partner offers. These are
 * different: they exist so an agent can find out *why* it was refused and what
 * the ground rules are, rather than retrying a call that will never succeed.
 *
 * That distinction is the difference between exposing a tool surface and
 * designing one. A refusal an agent cannot interrogate leaves it guessing; a
 * refusal it can ask about turns policy into something it can plan around.
 */
export function registerPolicyTools(
  ledger: Ledger,
  signal: AbortSignal,
): Promise<void[]> {
  const mc = modelContext();
  if (!mc) return Promise.resolve([]);

  const origins = Object.keys(TRUST) as OriginName[];

  return Promise.all([
    mc.registerTool(
      {
        name: "airlock_list_origins",
        description:
          "List the origins Airlock knows about and how far each is trusted, with the reason for each classification. Call this before planning work that spans more than one origin — it tells you which origins produce untrusted content and which can perform real writes. Read-only.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: async () =>
          JSON.stringify(
            origins.map((name) => ({
              origin: name,
              url: TRUST[name].url,
              trust: TRUST[name].trust,
              emitsUntrustedContent: TRUST[name].emitsUntrustedContent,
              why: TRUST[name].rationale,
            })),
            null,
            2,
          ),
      },
      { signal },
    ),

    mc.registerTool(
      {
        name: "airlock_explain_decision",
        description:
          "Explain why Airlock allowed, blocked or asked about a recent call. Use this after a refusal instead of retrying: it names the origin each value came from and the boundary the call would have crossed, so you can tell the user precisely what was refused and why. Read-only.",
        inputSchema: {
          type: "object",
          properties: {
            toolName: {
              type: "string",
              description:
                "Name of the tool whose most recent decision you want explained, for example dispatch_send_message. Omit to get the last few decisions.",
            },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: async ({ toolName }) => {
          const all = ledger.list();
          const matches =
            typeof toolName === "string" && toolName
              ? all.filter((e) => e.toolName === toolName)
              : all;

          if (matches.length === 0) {
            return JSON.stringify(
              {
                error:
                  typeof toolName === "string" && toolName
                    ? `Airlock has no record of a call to "${toolName}" in this session.`
                    : "No calls have been mediated in this session yet.",
                hint: "Decisions are recorded as calls happen. Call a tool first, then ask again.",
                toolsWithDecisions: [...new Set(all.map((e) => e.toolName))],
              },
              null,
              2,
            );
          }

          return JSON.stringify(
            matches.slice(0, 5).map((e) => ({
              tool: e.toolName,
              origin: e.origin,
              outcome: e.outcome,
              treatedAsWrite: e.decision.treatedAsWrite,
              reasons: e.decision.reasons.map((r) => r.detail),
              valuesTracedTo: e.decision.taint.map((t) => ({
                origin: t.source.origin,
                fromTool: t.source.toolName,
                matchedText: t.fragment,
              })),
              canBeRetried: e.outcome !== "blocked",
            })),
            null,
            2,
          );
        },
      },
      { signal },
    ),
  ]);
}
