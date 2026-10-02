export function WhoVotedWhatWarning({ className = '' }: { className?: string }) {
  return (
    <p role="alert" className={`rounded-2xl bg-accent px-3 py-2 font-bold text-white ${className}`}>
      Ojo: al final todos van a ver quién votó qué.
    </p>
  );
}
