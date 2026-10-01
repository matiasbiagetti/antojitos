import type { RoomConfig, VisibilityConfig } from '@/lib/domain/types';

export const VISIBILITY_LABELS: { key: keyof VisibilityConfig; label: string }[] = [
  { key: 'showRanking', label: 'Ranking completo de categorías' },
  { key: 'showScores', label: 'Puntaje por categoría' },
  { key: 'showSuperCounts', label: 'Cantidad de súper antojos' },
  { key: 'showTiebreakPath', label: 'Si hubo ballotage o ruleta, y cómo se llegó' },
  { key: 'showWhoVotedWhat', label: 'Quién votó qué' },
];

export function VisibilitySummary({ config }: { config: RoomConfig }) {
  const shown = VISIBILITY_LABELS.filter(({ key }) => config.visibility[key]);
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="font-extrabold">Qué se va a mostrar al final</h2>
      {config.visibility.showWhoVotedWhat && (
        <p role="alert" className="mt-3 rounded-2xl bg-accent px-3 py-2 font-bold text-white">
          Ojo: al final todos van a ver quién votó qué.
        </p>
      )}
      <ul className="mt-3 space-y-1 text-sm">
        <li>✅ La categoría ganadora</li>
        {shown.map(({ key, label }) => (
          <li key={key}>✅ {label}</li>
        ))}
      </ul>
      {!config.visibility.showWhoVotedWhat && (
        <p className="mt-3 text-sm text-ink/70">🔒 Nadie ve lo que votó cada uno.</p>
      )}
      <p className="mt-3 text-sm text-ink/70">⏱️ Ronda de {config.roundSeconds} segundos.</p>
    </section>
  );
}
