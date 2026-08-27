import { Link, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useAcademic } from "./store";
import type { CoverageStatus } from "./types";

const COVERAGE_LABEL: Record<CoverageStatus, string> = {
  "not-taught": "Not Taught",
  "in-progress": "In Progress",
  taught: "Taught",
};

const COVERAGE_TONE = {
  "not-taught": "neutral",
  "in-progress": "warning",
  taught: "success",
} as const;

function masteryTone(percent: number): "danger" | "warning" | "success" {
  if (percent < 50) return "danger";
  if (percent < 75) return "warning";
  return "success";
}

export function CourseDetailPage() {
  const { courseId } = useParams();
  const { courses, getTopicsForCourse, getAssessmentsForCourse, getCourseWeightedScore } = useAcademic();
  const course = courses.find((c) => c.id === courseId);

  if (!course) {
    return <div className="text-text-muted text-sm">Course not found.</div>;
  }

  const topics = getTopicsForCourse(course.id);
  const assessments = getAssessmentsForCourse(course.id);
  const weightedScore = getCourseWeightedScore(course.id);

  const avgPersonalStudy = Math.round(
    topics.reduce((s, t) => s + t.personalStudyPercent, 0) / (topics.length || 1)
  );
  const avgMastery = Math.round(topics.reduce((s, t) => s + t.masteryPercent, 0) / (topics.length || 1));
  const taughtCount = topics.filter((t) => t.professorCoverage === "taught").length;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/academics" className="text-text-muted text-xs hover:text-text-secondary">
          ← Academics
        </Link>
        <h2 className="text-text-primary text-xl font-semibold mt-1">
          {course.title} <span className="text-text-muted text-base">({course.code})</span>
        </h2>
        <p className="text-text-muted text-sm">
          {course.professorName} · {course.creditHours} Credit Hours
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Syllabus Coverage</div>
          <div className="text-text-primary text-lg font-semibold">
            {taughtCount} / {topics.length}
          </div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Personal Study</div>
          <div className="text-text-primary text-lg font-semibold">{avgPersonalStudy}%</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Mastery (avg)</div>
          <div className="text-text-primary text-lg font-semibold">{avgMastery}%</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Weighted Score So Far</div>
          <div className="text-text-primary text-lg font-semibold">{weightedScore.toFixed(1)}%</div>
        </Card>
      </div>

      <Card title="Syllabus & Topic Progress">
        <p className="text-text-disabled text-[11px] mb-3">
          Professor coverage, personal study, and mastery are tracked separately and never collapsed
          into one number — per the locked product rule for this domain.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-xs text-left">
              <th className="font-normal pb-2">Topic</th>
              <th className="font-normal pb-2">Professor</th>
              <th className="font-normal pb-2">Personal Study</th>
              <th className="font-normal pb-2">Mastery</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((t) => (
              <tr key={t.id} className="border-t border-border-subtle">
                <td className="py-2 text-text-primary">{t.title}</td>
                <td className="py-2">
                  <Badge tone={COVERAGE_TONE[t.professorCoverage]}>{COVERAGE_LABEL[t.professorCoverage]}</Badge>
                </td>
                <td className="py-2 text-text-secondary">{t.personalStudyPercent}%</td>
                <td className="py-2">
                  <Badge tone={masteryTone(t.masteryPercent)}>{t.masteryPercent}%</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={`Assessments (${assessments.length})`}>
        <div className="space-y-1">
          {assessments.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0"
            >
              <div>
                <div className="text-text-primary text-sm">{a.title}</div>
                <div className="text-text-muted text-xs capitalize">
                  {a.category} · {a.weightPercent}% weight
                </div>
              </div>
              <div className="text-text-secondary text-xs">
                {a.obtainedMarks !== null ? `${a.obtainedMarks} / ${a.totalMarks}` : `— / ${a.totalMarks}`}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
