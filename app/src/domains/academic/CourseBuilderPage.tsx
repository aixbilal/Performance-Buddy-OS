/**
 * Course Builder — `/academics/new` and `/academics/:courseId/edit`.
 * One form for both; validation errors preserve input.
 */
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { useAcademic } from "./store";
import { CourseForm, EMPTY_COURSE_FORM, type CourseFormValues } from "./CourseForm";
import type { CourseInput } from "./types";

export function CourseBuilderPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { getCourse, createCourse, updateCourse, saveState, semesters } = useAcademic();

  const editing = courseId ? getCourse(courseId) : undefined;
  const isEdit = Boolean(courseId);

  const initialForm = useMemo<CourseFormValues>(() => {
    if (editing) {
      return {
        title: editing.title,
        code: editing.code,
        creditHours: String(editing.creditHours),
        professorName: editing.professorName,
        status: editing.status,
        targetGrade: editing.targetGrade ?? "",
        projectedGrade: editing.projectedGrade ?? "",
        semesterId: editing.semesterId ?? "",
      };
    }
    return EMPTY_COURSE_FORM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  if (isEdit && !editing) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => navigate("/academics")}
          className="text-text-muted text-xs hover:text-text-secondary"
        >
          ← Academics
        </button>
        <p className="text-text-muted text-sm">That course doesn't exist.</p>
      </div>
    );
  }

  const submit = async (input: CourseInput) => {
    const res =
      isEdit && courseId ? await updateCourse(courseId, input) : await createCourse(input);
    if (res.ok) navigate(`/academics/${res.id}`);
    return res;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <button
          onClick={() => navigate(isEdit ? `/academics/${courseId}` : "/academics")}
          className="text-text-muted text-xs hover:text-text-secondary"
        >
          ← {isEdit ? "Course" : "Academics"}
        </button>
        <h2 className="t-h2 text-text-primary mt-1">
          {isEdit ? "Edit Course" : "Add Course"}
        </h2>
        <p className="text-text-muted text-sm">
          {isEdit
            ? "Update this course. Changes are validated and saved to your local database."
            : "Add a course you're taking. It appears in Academics immediately."}
        </p>
      </div>

      <Card>
        <CourseForm
          initial={initialForm}
          submitLabel={isEdit ? "Save Course" : "Add Course"}
          busy={saveState === "saving"}
          semesters={semesters}
          onSubmit={submit}
          onCancel={() => navigate(isEdit ? `/academics/${courseId}` : "/academics")}
        />
      </Card>
    </div>
  );
}
