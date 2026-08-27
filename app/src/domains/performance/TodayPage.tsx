import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { ProposalCard, type Proposal } from "../intelligence/ProposalCard";

/**
 * STRUCTURAL SKELETON ONLY.
 * Matches the layout of Design Assets/02 - Today/Approved/Today-v1-PRIMARY.png.
 * Data below is placeholder/mock — the local persistence layer (Day 2+ of the
 * semester roadmap, Phase 1) is not wired yet. This exists so the shell/routing/
 * component strategy can be verified against a real screen shape now, per the
 * Day 2 handoff instruction, without pulling Phase 1 data work forward.
 */

const MOCK_GLANCE = [
  { label: "Study Time", value: "4h 36m", sub: "/ 6h 30m target" },
  { label: "Tasks Completed", value: "8 / 12", sub: "67%" },
  { label: "Focus Score", value: "82 / 100", sub: "Great focus" },
];

const MOCK_PLAN = [
  { time: "08:00", title: "Data Structures Class", sub: "CONSATS University", tag: "Class" },
  { time: "10:00", title: "DSA Practice", sub: "Arrays & Strings", tag: "Study" },
  { time: "12:30", title: "Calculus Revision", sub: "Integration", tag: "Study" },
];

const MOCK_PROPOSAL: Proposal = {
  id: "p1",
  recommendation: "Reduce today's DSA study block by 1h.",
  reason: "You've already covered today's DSA class topic.",
  evidence: ["Class attendance logged 08:00–09:00", "DSA topic matches today's lecture"],
  confidence: "medium",
};

export function TodayPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Good evening.</h2>
        <p className="text-text-muted text-sm">Here's your performance overview for today.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {MOCK_GLANCE.map((g) => (
          <Card key={g.label}>
            <div className="text-text-muted text-xs mb-1">{g.label}</div>
            <div className="text-text-primary text-lg font-semibold">{g.value}</div>
            <div className="text-text-secondary text-xs">{g.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card title="Today's Plan" className="col-span-2">
          <div className="space-y-2">
            {MOCK_PLAN.map((item) => (
              <div
                key={item.time}
                className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-text-muted text-xs w-12">{item.time}</span>
                  <div>
                    <div className="text-text-primary text-sm">{item.title}</div>
                    <div className="text-text-muted text-xs">{item.sub}</div>
                  </div>
                </div>
                <Badge>{item.tag}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card title="AI Coach">
          <ProposalCard
            proposal={MOCK_PROPOSAL}
            onApprove={() => {}}
            onModify={() => {}}
            onReject={() => {}}
          />
        </Card>
      </div>
    </div>
  );
}
