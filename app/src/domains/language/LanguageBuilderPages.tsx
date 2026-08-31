/**
 * Builder routes:
 *   /language/paths/new · /language/paths/:pathId/edit
 *   /language/books/new · /language/books/:bookId/edit
 */
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { useKnowledge } from "../knowledge/store";
import { useRoutine } from "../routine/store";
import { useLanguage } from "./store";
import { EMPTY_PATH_FORM, PathForm, type PathFormValues } from "./PathForm";
import { EMPTY_BOOK_FORM, BookForm, type BookFormValues } from "./BookForm";
import type { BookInput, PathInput } from "./types";

function Shell({
  back,
  backLabel,
  title,
  subtitle,
  children,
}: {
  back: string;
  backLabel: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <button
          onClick={() => navigate(back)}
          className="text-text-muted text-xs hover:text-text-secondary"
        >
          ← {backLabel}
        </button>
        <h2 className="text-text-primary text-xl font-semibold mt-1">{title}</h2>
        <p className="text-text-muted text-sm">{subtitle}</p>
      </div>
      <Card>{children}</Card>
    </div>
  );
}

export function PathBuilderPage() {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const { getPath, createPath, updatePath, saveState } = useLanguage();
  const { routines } = useRoutine();

  const editing = pathId ? getPath(pathId) : undefined;
  const isEdit = Boolean(pathId);

  const initial = useMemo<PathFormValues>(() => {
    if (editing) {
      return {
        language: editing.language,
        title: editing.title,
        targetLevel: editing.targetLevel,
        status: editing.status,
        relatedRoutineId: editing.relatedRoutineId ?? "",
      };
    }
    return EMPTY_PATH_FORM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathId]);

  if (isEdit && !editing) {
    return (
      <Shell back="/language" backLabel="Reading & Language" title="Edit Path" subtitle="">
        <p className="text-text-muted text-sm">That path doesn't exist.</p>
      </Shell>
    );
  }

  const submit = async (input: PathInput) => {
    const res = isEdit && pathId ? await updatePath(pathId, input) : await createPath(input);
    if (res.ok) navigate(`/language/paths/${res.id}`);
    return res;
  };

  return (
    <Shell
      back={isEdit ? `/language/paths/${pathId}` : "/language"}
      backLabel={isEdit ? "Path" : "Reading & Language"}
      title={isEdit ? "Edit Language Path" : "New Language Path"}
      subtitle="A path is what you're learning and how far along the curriculum is — not daily minutes."
    >
      <PathForm
        initial={initial}
        submitLabel={isEdit ? "Save Path" : "Create Path"}
        routines={routines.filter((r) => !r.archived)}
        busy={saveState === "saving"}
        onSubmit={submit}
        onCancel={() => navigate(isEdit ? `/language/paths/${pathId}` : "/language")}
      />
    </Shell>
  );
}

export function BookBuilderPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { getBook, createBook, updateBook, saveState } = useLanguage();
  const { topics } = useKnowledge();

  const editing = bookId ? getBook(bookId) : undefined;
  const isEdit = Boolean(bookId);

  const initial = useMemo<BookFormValues>(() => {
    if (editing) {
      return {
        title: editing.title,
        author: editing.author,
        status: editing.status,
        currentPage: String(editing.currentPage),
        totalPages: editing.totalPages !== null ? String(editing.totalPages) : "",
        currentChapter: String(editing.currentChapter),
        knowledgeTopicId: editing.knowledgeTopicId ?? "",
        noteRef: editing.noteRef,
      };
    }
    return EMPTY_BOOK_FORM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  if (isEdit && !editing) {
    return (
      <Shell back="/language" backLabel="Reading & Language" title="Edit Book" subtitle="">
        <p className="text-text-muted text-sm">That book doesn't exist.</p>
      </Shell>
    );
  }

  const submit = async (input: BookInput) => {
    const res = isEdit && bookId ? await updateBook(bookId, input) : await createBook(input);
    if (res.ok) navigate(`/language/books/${res.id}`);
    return res;
  };

  return (
    <Shell
      back={isEdit ? `/language/books/${bookId}` : "/language"}
      backLabel={isEdit ? "Book" : "Reading & Language"}
      title={isEdit ? "Edit Book" : "Add Book"}
      subtitle="Track real reading position. Pages read are activity — never proof of understanding."
    >
      <BookForm
        initial={initial}
        submitLabel={isEdit ? "Save Book" : "Add Book"}
        topics={topics.map((t) => ({ id: t.id, title: t.title }))}
        busy={saveState === "saving"}
        onSubmit={submit}
        onCancel={() => navigate(isEdit ? `/language/books/${bookId}` : "/language")}
      />
    </Shell>
  );
}
