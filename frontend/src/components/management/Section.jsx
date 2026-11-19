// A titled card of the Management Dashboard. `actions` sits on the right of the title row (pickers, badges).
export default function Section({ title, hint, actions, children, bodyClassName = 'p-5' }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-700">{title}</h2>
          {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
        </div>
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

// Loading / empty / error line inside a section body.
export function SectionNote({ children }) {
  return <p className="px-5 py-8 text-center text-sm text-slate-400">{children}</p>;
}
