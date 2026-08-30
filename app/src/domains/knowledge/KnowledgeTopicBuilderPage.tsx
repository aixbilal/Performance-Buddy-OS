/**
 * Knowledge Topic Builder — `/knowledge/new` and `/knowledge/:topicId/edit`.
 */
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { useKnowledge } from "./store";
import {
  EMPTY_KNOWLEDGE_TOPIC_FORM,
  KnowledgeTopicForm,
  type KnowledgeTopicFormValues,
} from "./KnowledgeTopicForm";
import type { TopicInput } from "./types";

export function KnowledgeTopicBuilderPage() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { getTopic, createTopic, updateTopic, saveState } = useKnowledge();

  const editing = topicId ? getTopic(topicId) : undefined;
  const isEdit = Boolean(topicId);

  const initialForm = useMemo<KnowledgeTopicFormValues>(() => {
    if (editing) {
      return { title: editing.title, category: editing.category, context: editing.context };
    }
    return EMPTY_KNOWLEDGE_TOPIC_FORM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  if (isEdit && !editing) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => navigate("/knowledge")}
          className="text-text-muted text-xs hover:text-text-secondary"
        >
          ← Knowledge
        </button>
        <p className="text-text-muted text-sm">That topic doesn't exist.</p>
      </div>
    );
  }

  const submit = async (input: TopicInput) => {
    const res = isEdit && topicId ? await updateTopic(topicId, input) : await createTopic(input);
    if (res.ok) navigate(`/knowledge/${res.id}`);
    return res;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <button
          onClick={() => navigate(isEdit ? `/knowledge/${topicId}` : "/knowledge")}
          className="text-text-muted text-xs hover:text-text-secondary"
        >
          ← {isEdit ? "Topic" : "Knowledge"}
        </button>
        <h2 className="text-text-primary text-xl font-semibold mt-1">
          {isEdit ? "Edit Topic" : "Add Knowledge Topic"}
        </h2>
        <p className="text-text-muted text-sm">
          A topic tracks what you understand. Mastery is derived from evidence you record — there is
          no mastery slider.
        </p>
      </div>
      <Card>
        <KnowledgeTopicForm
          initial={initialForm}
          submitLabel={isEdit ? "Save Topic" : "Add Topic"}
          busy={saveState === "saving"}
          onSubmit={submit}
          onCancel={() => navigate(isEdit ? `/knowledge/${topicId}` : "/knowledge")}
        />
      </Card>
    </div>
  );
}
