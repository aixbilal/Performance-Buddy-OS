import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { SaveIndicator } from "../../components/SaveIndicator";
import { StatCard } from "../../components/StatCard";
import { useAcademic } from "./store";

const STATUS_TONE = {
  "on-track": "success",
  "at-risk": "warning",
  "off-track": "danger",
} as const;

export function AcademicsOverviewPage() {
  const navigate = useNavigate();
  const { semester, courses, cgpa, projectedSGPA, saveState, loaded } = useAcademic();

  const activeCourses = courses.filter((c) => !c.archived);
  const archivedCourses = courses.filter((c) => c.archived);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-text-primary text-xl font-semibold">Academics</h2>
          <p className="text-text-muted text-sm">{semester.label}</p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          <button
            onClick={() => navigate("/academics/new")}
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
          >
            Add Course
          </button>
        </div>
      </div>

      {loaded && activeCourses.length === 0 && archivedCourses.length === 0 ? (
        <Card>
          <EmptyState
            icon="🎓"
            title="No courses yet"
            description="Add the courses you're taking this semester. Grades, topics and assessments all live under a course."
            primaryAction={{ label: "Add your first course", onClick: () => navigate("/academics/new") }}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Current CGPA"
              value={cgpa.cgpa !== null ? cgpa.cgpa.toFixed(2) : "—"}
              sub={
                cgpa.cgpa !== null
                  ? `${cgpa.totalCreditsCounted} credit hours`
                  : "No graded courses yet"
              }
            />
            <StatCard
              label="Projected SGPA"
              value={projectedSGPA !== null ? projectedSGPA.toFixed(2) : "—"}
              sub={projectedSGPA !== null ? semester.label : "Set projected grades to see this"}
            />
            <StatCard label="Courses" value={activeCourses.length} />
          </div>

          {cgpa.blockedByUnresolvedRepeatPolicy && (
            <div className="bg-status-warning/10 border border-status-warning/30 rounded-md px-4 py-3 text-xs text-status-warning">
              {cgpa.excludedCourseIds.length} course(s) with more than one attempt are excluded from
              CGPA because the repeat-grade policy for your institution isn't verified yet — rather
              than a guessed "best grade" rule being applied silently.
            </div>
          )}

          <Card title="Courses">
            {activeCourses.length === 0 ? (
              <div className="text-text-muted text-xs py-2">
                No active courses. {archivedCourses.length} archived.
              </div>
            ) : (
              <div className="space-y-1">
                {activeCourses.map((course) => (
                  <Link
                    key={course.id}
                    to={`/academics/${course.id}`}
                    className="flex items-center justify-between py-2.5 border-b border-border-subtle last:border-0 hover:bg-surface-inset -mx-2 px-2 rounded-md"
                  >
                    <div>
                      <div className="text-text-primary text-sm">
                        {course.title}
                        {course.code && <span className="text-text-muted"> ({course.code})</span>}
                      </div>
                      <div className="text-text-muted text-xs">
                        {course.professorName || "No instructor set"} · {course.creditHours} Credit
                        Hours
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-text-secondary text-xs">
                        {course.projectedGrade ? `Projected ${course.projectedGrade}` : "No projection"}
                      </span>
                      <Badge tone={STATUS_TONE[course.status]}>
                        {course.status.replace("-", " ")}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {archivedCourses.length > 0 && (
            <Card title={`Archived (${archivedCourses.length})`}>
              <div className="space-y-1">
                {archivedCourses.map((course) => (
                  <Link
                    key={course.id}
                    to={`/academics/${course.id}`}
                    className="flex items-center justify-between py-2 text-text-muted text-sm hover:bg-surface-inset -mx-2 px-2 rounded-md"
                  >
                    <span>
                      {course.title}
                      {course.code && ` (${course.code})`}
                    </span>
                    <Badge>archived</Badge>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <Link
            to="/academics/sgpa-cgpa"
            className="inline-block text-text-secondary text-sm hover:text-text-primary underline"
          >
            View SGPA / CGPA Intelligence →
          </Link>
        </>
      )}
    </div>
  );
}
