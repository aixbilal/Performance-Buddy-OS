import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { StatCard } from "../../components/StatCard";
import { useAcademic } from "./store";

const STATUS_TONE = {
  "on-track": "success",
  "at-risk": "warning",
  "off-track": "danger",
} as const;

export function AcademicsOverviewPage() {
  const { semester, courses, cgpa, projectedSGPA, assessmentsSaveState } = useAcademic();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-text-primary text-xl font-semibold">Academics</h2>
          <p className="text-text-muted text-sm">{semester.label}</p>
        </div>
        <SaveIndicator state={assessmentsSaveState} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Current CGPA" value={cgpa.cgpa !== null ? cgpa.cgpa.toFixed(2) : "—"} sub={`${cgpa.totalCreditsCounted} credit hours`} />
        <StatCard label="Projected SGPA" value={projectedSGPA !== null ? projectedSGPA.toFixed(2) : "—"} sub={semester.label} />
        <StatCard label="Courses This Semester" value={courses.length} />
      </div>

      {cgpa.blockedByUnresolvedRepeatPolicy && (
        <div className="bg-status-warning/10 border border-status-warning/30 rounded-md px-4 py-3 text-xs text-status-warning">
          {cgpa.excludedCourseIds.length} course(s) with more than one attempt are excluded from CGPA
          because the repeat-grade policy for your institution isn't verified yet — see Settings once
          that's configured, rather than a guessed "best grade" rule being applied silently.
        </div>
      )}

      <Card title="Courses">
        <div className="space-y-1">
          {courses.map((course) => (
            <Link
              key={course.id}
              to={`/academics/${course.id}`}
              className="flex items-center justify-between py-2.5 border-b border-border-subtle last:border-0 hover:bg-surface-inset -mx-2 px-2 rounded-md"
            >
              <div>
                <div className="text-text-primary text-sm">
                  {course.title} <span className="text-text-muted">({course.code})</span>
                </div>
                <div className="text-text-muted text-xs">
                  {course.professorName} · {course.creditHours} Credit Hours
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-text-secondary text-xs">Projected {course.projectedGrade}</span>
                <Badge tone={STATUS_TONE[course.status]}>{course.status.replace("-", " ")}</Badge>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <Link
        to="/academics/sgpa-cgpa"
        className="inline-block text-text-secondary text-sm hover:text-text-primary underline"
      >
        View SGPA / CGPA Intelligence →
      </Link>
    </div>
  );
}
