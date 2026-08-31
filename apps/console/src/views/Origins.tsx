import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TRUST, type DiscoveredTool, type OriginName } from "@airlock/shared";
import { ToolCard } from "../ui/ToolCard";
import { Sheet } from "../ui/Sheet";
import {
  Badge,
  Button,
  Cell,
  Dot,
  Facts,
  Row,
  RowButton,
  SectionTitle,
  Table,
  ViewHeader,
  toneForTrust,
} from "../ui/primitives";

const PARTNERS = ["vault", "dispatch", "bazaar"] as const;

/**
 * The origins Airlock federates, and what each currently publishes.
 *
 * Trust is Airlock's own classification, fixed here and never moved by anything
 * an origin asserts about itself. The capability count is live: lock the vault
 * in its own fixture and the row drops without a reload, because the mediated
 * surface follows partner state rather than a snapshot taken at boot.
 */
export function Origins({
  tools,
  unreachable,
  fixturesOpen,
  onToggleFixtures,
  onCall,
}: {
  tools: readonly DiscoveredTool[];
  unreachable: ReadonlySet<string>;
  fixturesOpen: boolean;
  onToggleFixtures: () => void;
  onCall: (tool: DiscoveredTool, args: Record<string, unknown>) => void;
}) {
  const [selected, setSelected] = useState<OriginName | null>(null);

  const countFor = (name: OriginName) =>
    tools.filter((t) => t.profile?.name === name).length;
  const profile = selected ? TRUST[selected] : null;
  const published = selected
    ? tools.filter((t) => t.profile?.name === selected)
    : [];

  return (
    <div>
      <ViewHeader
        title="Origins"
        lede="Four independently deployed origins. Trust is Airlock's classification of each, never a claim the origin makes about itself."
      />

      <div className="bg-surface rounded-md ring-1 ring-line overflow-hidden">
        <Table
          head={["Origin", "Trust", "Capabilities", "Status"]}
          label="Federated origins"
        >
          {(["console", ...PARTNERS] as const).map((name) => {
            const p = TRUST[name];
            const offline = name !== "console" && unreachable.has(name);
            return (
              <Row
                key={name}
                onSelect={() => setSelected(name)}
                selected={selected === name}
              >
                <Cell>
                  <RowButton mono onSelect={() => setSelected(name)}>
                    {p.name}
                  </RowButton>
                </Cell>
                <Cell>
                  <Badge tone={toneForTrust(p.trust)}>{p.trust}</Badge>
                </Cell>
                <Cell muted mono>
                  {name === "console" ? "policy engine" : countFor(name)}
                </Cell>
                <Cell>
                  <span className="inline-flex items-center gap-2">
                    <Dot
                      tone={offline ? "blocked" : "trusted"}
                      hollow={offline}
                    />
                    <span className={offline ? "text-blocked" : "text-fg-2"}>
                      {offline ? "Unavailable" : "Online"}
                    </span>
                  </span>
                </Cell>
              </Row>
            );
          })}
        </Table>
      </div>

      <div className="mt-6">
        <Button
          variant="ghost"
          size="sm"
          icon={fixturesOpen ? ChevronDown : ChevronRight}
          onClick={onToggleFixtures}
          aria-expanded={fixturesOpen}
        >
          Partner fixtures
        </Button>
        <p className="text-[12px] text-fg-2 mt-1.5 ml-2.5 max-w-[70ch]">
          The three partner sites, each running in its own frame with{" "}
          <code className="font-mono">allow=&quot;tools&quot;</code>. Change
          their state here — lock the vault and its capability leaves the
          mediated surface without a reload.
        </p>
      </div>

      {profile && selected && (
        <Sheet
          onClose={() => setSelected(null)}
          title={profile.name}
          subtitle={profile.url.replace("https://", "")}
        >
          <div className="grid gap-6">
            <section>
              <Facts
                rows={[
                  [
                    "Trust",
                    <Badge key="t" tone={toneForTrust(profile.trust)}>
                      {profile.trust}
                    </Badge>,
                  ],
                  [
                    "Untrusted content",
                    profile.emitsUntrustedContent ? "yes" : "no",
                  ],
                  [
                    "Capabilities",
                    selected === "console"
                      ? "policy engine"
                      : String(published.length),
                  ],
                  [
                    "Status",
                    unreachable.has(selected) ? "Unavailable" : "Online",
                  ],
                ]}
              />
              <p className="text-[13px] text-fg-3 leading-[1.6] mt-4 m-0">
                {profile.rationale}
              </p>
            </section>

            <section>
              <SectionTitle className="mb-3">Capabilities</SectionTitle>
              {published.length === 0 ? (
                <p className="text-[12.5px] text-fg-4 m-0">
                  {selected === "console"
                    ? "Airlock's own policy tools are listed in the WebMCP view."
                    : unreachable.has(selected)
                      ? "This origin did not load, so its capabilities are absent."
                      : "Nothing published right now."}
                </p>
              ) : (
                <div className="grid gap-2">
                  {published.map((t) => (
                    <ToolCard
                      key={`${t.raw.origin}-${t.name}`}
                      tool={t}
                      onRun={onCall}
                    />
                  ))}
                </div>
              )}
              <p className="text-[12px] text-fg-4 mt-4 m-0">
                A call from here goes through the same policy engine an
                agent&apos;s call does.
              </p>
            </section>
          </div>
        </Sheet>
      )}
    </div>
  );
}
