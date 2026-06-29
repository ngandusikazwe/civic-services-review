import { Save } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type {
  ApplicationCategory,
  ApplicationPayload,
  ApplicationWithAudit
} from "../types";
import { statusLabel } from "../lib/format";

type ApplicationFormProps = {
  application?: ApplicationWithAudit;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (payload: ApplicationPayload) => Promise<void>;
};

const categories: ApplicationCategory[] = [
  "BUSINESS_PERMIT",
  "BUILDING_PERMIT",
  "COMMUNITY_GRANT",
  "PUBLIC_WORKS",
  "GENERAL_SERVICE"
];

const categoryLabels: Record<ApplicationCategory, string> = {
  BUSINESS_PERMIT: "Business permit",
  BUILDING_PERMIT: "Building permit",
  COMMUNITY_GRANT: "Community grant",
  PUBLIC_WORKS: "Public works",
  GENERAL_SERVICE: "General service"
};

export function ApplicationForm({
  application,
  loading,
  onCancel,
  onSubmit
}: ApplicationFormProps) {
  const initial = useMemo(
    () => ({
      title: application?.title ?? "",
      category: application?.category ?? "BUSINESS_PERMIT",
      description: application?.description ?? "",
      amount: application?.amountCents ? String(application.amountCents / 100) : ""
    }),
    [application]
  );
  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState<ApplicationCategory>(initial.category);
  const [description, setDescription] = useState(initial.description);
  const [amount, setAmount] = useState(initial.amount);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const numericAmount = amount.trim() ? Number(amount) : null;

    if (numericAmount !== null && (!Number.isFinite(numericAmount) || numericAmount < 0)) {
      setError("Estimated value must be a positive number.");
      return;
    }

    try {
      await onSubmit({
        title,
        category,
        description,
        amountCents:
          numericAmount === null ? null : Math.round(numericAmount * 100)
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    }
  }

  return (
    <section className="workspace-panel" aria-busy={loading} aria-labelledby="form-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{application ? statusLabel(application.status) : "Draft"}</p>
          <h2 id="form-title">{application ? "Edit request" : "New request"}</h2>
        </div>
      </div>
      <form className="application-form" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            minLength={3}
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </label>
        <label>
          Category
          <select
            onChange={(event) => setCategory(event.target.value as ApplicationCategory)}
            value={category}
          >
            {categories.map((option) => (
              <option key={option} value={option}>
                {categoryLabels[option]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estimated value
          <input
            inputMode="decimal"
            min="0"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            type="number"
            value={amount}
          />
        </label>
        <label className="span-2">
          Description
          <textarea
            minLength={10}
            onChange={(event) => setDescription(event.target.value)}
            required
            rows={7}
            value={description}
          />
        </label>
        {error ? <p className="form-error span-2">{error}</p> : null}
        <div className="form-actions span-2">
          <button className="secondary-action" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="primary-action" disabled={loading} type="submit">
            <Save size={17} />
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </section>
  );
}
