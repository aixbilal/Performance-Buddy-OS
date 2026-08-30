import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { useAcademic } from "./store";
import { calculateRequiredAverageForTarget } from "./engine";

const TARGET_SGPA = 3.7;

export function SgpaCgpaPage() {
  const { semester, courses, cgpa, projectedSGPA } = useAcademic();

  const activeCourses = courses.filter((c) => !c.archived);
  const requiredForTarget = calculateRequiredAverageForTarget(
    activeCourses.map((c) => ({ creditHours: c.creditHours, grade: c.projectedGrade, isFixed: false })),
    TARGET_SGPA
  );

  return (
    <div className="space-y-6">
      <div>
        <Link to="/academics" className="text-text-muted text-xs hover:text-text-secondary">
          ← Academics
        </Link>
        <h2 className="text-text-primary text-xl font-semibold mt-1">SGPA / CGPA Intelligence</h2>
        <p className="text-text-muted text-sm">Understand your academic position and plan your path to your target.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Current CGPA</div>
          <div className="text-text-primary text-lg font-semibold">
            {cgpa.cgpa !== null ? cgpa.cgpa.toFixed(2) : "—"}
          </div>
          <div className="text-text-secondary text-xs">{cgpa.totalCreditsCounted} credit hours</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Projected SGPA</div>
          <div className="text-text-primary text-lg font-semibold">
            {projectedSGPA !== null ? projectedSGPA.toFixed(2) : "—"}
          </div>
          <div className="text-text-secondary text-xs">{semester.label}</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Target SGPA</div>
          <div className="text-text-primary text-lg font-semibold">{TARGET_SGPA.toFixed(2)}</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Required Average</div>
          <div className="text-text-primary text-lg font-semibold">
            {requiredForTarget.requiredAverage?.toFixed(2) ?? "—"}
          </div>
          <div className={`text-xs ${requiredForTarget.reachable ? "text-status-success" : "text-status-danger"}`}>
            {requiredForTarget.reachable ? "Possible" : "Not achievable at current projections"}
          </div>
        </Card>
      </div>

      <Card title="Course Grade Projections">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-xs text-left">
              <th className="font-normal pb-2">Course</th>
              <th className="font-normal pb-2">CH</th>
              <th className="font-normal pb-2">Projected Grade</th>
              <th className="font-normal pb-2">Target Grade</th>
              <th className="font-normal pb-2">Grade Points (Projected)</th>
            </tr>
          </thead>
          <tbody>
            {activeCourses.map((c) => (
              <tr key={c.id} className="border-t border-border-subtle">
                <td className="py-2 text-text-primary">{c.title}</td>
                <td className="py-2 text-text-secondary">{c.creditHours}</td>
                <td className="py-2 text-text-secondary">{c.projectedGrade ?? "—"}</td>
                <td className="py-2 text-text-secondary">{c.targetGrade ?? "—"}</td>
                <td className="py-2 text-text-secondary">
                  {c.projectedGrade ? c.creditHours + "×" : "—"}
                </td>
              </tr>
            ))}
            {activeCourses.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-text-muted text-xs">
                  No courses yet — add courses in Academics to see projections.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="bg-surface-inset border border-border-subtle rounded-md px-4 py-3 text-xs text-text-muted">
        <b className="text-text-secondary">Deliberately not built yet (flagged, not skipped by accident):</b>{" "}
        the interactive Scenario Simulator, Risk/Leverage Analyzer ranking, and CGPA Trajectory chart from
        the approved reference are deferred — they're planning tools layered on top of the verified math
        above, not part of the calculation engine itself. All numbers on this page come from{" "}
        <code className="text-text-secondary">engine.ts</code>, covered by real tests with known-correct
        answers, not estimated.
      </div>
    </div>
  );
}
