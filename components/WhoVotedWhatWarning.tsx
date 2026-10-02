export function WhoVotedWhatWarning({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  return (
    <p
      role="alert"
      className={`rounded-2xl bg-accent font-bold text-white ${compact ? 'px-3 py-1 text-xs' : 'px-3 py-2'} ${className}`}
    >
      Ojo: al final todos van a ver quién votó qué.
    </p>
  );
}
