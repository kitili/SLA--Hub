"use client";

export function FarmCrudActions({
  onEdit,
  onDelete,
  className,
}: {
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}) {
  return (
    <div className={`flex shrink-0 flex-wrap gap-1.5 ${className ?? ""}`}>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-[var(--radius-sm)] border border-card-border bg-white px-2.5 py-1 text-xs font-semibold text-electric-blue hover:bg-light-blue-30"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-15 px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/10"
      >
        Delete
      </button>
    </div>
  );
}
