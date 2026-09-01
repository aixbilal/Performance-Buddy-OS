/**
 * The ONE Course form body. Used by:
 *   - manual creation  (/academics/new)
 *   - editing          (/academics/:courseId/edit)
 *
 * No score→grade rule, no repeat/replacement logic, no invented policy fields —
 * only the V1 fields the canonical `CourseInput` already represents. `targetGrade`
 * / `projectedGrade` are user-entered letters or "none".
 */
import { useState } from "react";
import { SelectField, TextField } from "../../components/FormFields";
import {
  COURSE_STATUSES,
  GRADE_LETTERS,
  type CourseInput,
  type CourseStatus,
  type GradeLetter,
  type Semester,
} from "./types";
import { FormActions } from "../../components/FormActions";

export type CourseFormValues = {
  title: string;
  code: string;
  creditHours: string;
  professorName: string;
  status: CourseStatus;
  targetGrade: GradeLetter | "";
  projectedGrade: GradeLetter | "";
  semesterId: string; // "" = unassigned
};

export const EMPTY_COURSE_FORM: CourseFormValues = {
  title: "",
  code: "",
  creditHours: "3",
  professorName: "",
  status: "on-track",
  targetGrade: "",
  projectedGrade: "",
  semesterId: "",
};

export function valuesToInput(v: CourseFormValues): CourseInput {
  return {
    title: v.title,
    code: v.code,
    creditHours: v.creditHours.trim() === "" ? NaN : Number(v.creditHours),
    professorName: v.professorName,
    status: v.status,
    targetGrade: v.targetGrade === "" ? null : v.targetGrade,
    projectedGrade: v.projectedGrade === "" ? null : v.projectedGrade,
    semesterId: v.semesterId === "" ? null : v.semesterId,
  };
}

const TITLE_CASE = (s: string) => (s === "" ? "— none —" : s.charAt(0).toUpperCase() + s.slice(1));
const GRADE_OPTIONS = ["", ...GRADE_LETTERS] as const;

export function CourseForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
  semesters = [],
}: {
  initial: CourseFormValues;
  submitLabel: string;
  onSubmit: (input: CourseInput) => Promise<{ ok: boolean; errors?: Record<string, string> }>;
  onCancel: () => void;
  busy?: boolean;
  semesters?: Semester[];
}) {
  const [v, setV] = useState<CourseFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof CourseFormValues>(k: K, val: CourseFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSubmit(valuesToInput(v));
    setErrors(res.ok ? {} : (res.errors ?? {}));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <TextField
        label="Course name"
        value={v.title}
        onChange={(x) => set("title", x)}
        error={errors.title}
        placeholder="e.g. Data Structures"
        autoFocus
      />

      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Course code (optional)"
          value={v.code}
          onChange={(x) => set("code", x)}
          error={errors.code}
          placeholder="e.g. CSE 201"
        />
        <TextField
          label="Credit hours"
          type="number"
          value={v.creditHours}
          onChange={(x) => set("creditHours", x)}
          error={errors.creditHours}
          placeholder="3"
        />
      </div>

      <TextField
        label="Instructor (optional)"
        value={v.professorName}
        onChange={(x) => set("professorName", x)}
        error={errors.professorName}
        placeholder="e.g. Prof. Sharma"
      />

      <div className="grid grid-cols-3 gap-4">
        <SelectField
          label="Status"
          value={v.status}
          options={COURSE_STATUSES}
          onChange={(x) => set("status", x)}
          labelFor={(s) => TITLE_CASE(s.replace("-", " "))}
          error={errors.status}
        />
        <SelectField
          label="Target grade"
          value={v.targetGrade}
          options={GRADE_OPTIONS}
          onChange={(x) => set("targetGrade", x)}
          labelFor={TITLE_CASE}
          error={errors.targetGrade}
        />
        <SelectField
          label="Projected grade"
          value={v.projectedGrade}
          options={GRADE_OPTIONS}
          onChange={(x) => set("projectedGrade", x)}
          labelFor={TITLE_CASE}
          error={errors.projectedGrade}
          hint="Your own estimate — never auto-derived from a score."
        />
      </div>

      {semesters.length > 0 && (
        <SelectField
          label="Semester"
          value={v.semesterId}
          options={["", ...semesters.map((s) => s.id)]}
          onChange={(x) => set("semesterId", x)}
          labelFor={(id) => (id === "" ? "— unassigned —" : (semesters.find((s) => s.id === id)?.label ?? id))}
        />
      )}

      {errors._ && <p className="t-small text-status-danger">{errors._}</p>}

      <FormActions submitLabel={submitLabel} busy={busy} onCancel={onCancel} />
    </form>
  );
}
