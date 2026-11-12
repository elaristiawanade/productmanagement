// Status pill for Client Management. The hue comes from the database (client_statuses.color, configurable in
// Client Settings), so StatusBadge's fixed STATUS_MAP is not used — its 'active' key would also clash (blue, not green).
export default function ClientStatusPill({ name, color }) {
  const c = color || '#7C8494';
  return (
    <span className="status-pill h-6 px-2 gap-1.5 text-[11px]" style={{ '--c': c }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
      {name}
    </span>
  );
}
