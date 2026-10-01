import Link from 'next/link';
import { Logo } from './Logo';

const COPY = {
  loading: { title: 'Cargando…', body: null, cta: false },
  missing: { title: 'Esta sala no existe o ya expiró', body: 'Las salas duran una hora.', cta: true },
  expired: { title: 'Esta sala expiró', body: 'Las salas duran una hora.', cta: true },
  full: { title: 'La sala está llena', body: 'Ya hay 15 personas adentro.', cta: true },
} as const;

export function StatusScreen({ kind }: { kind: keyof typeof COPY }) {
  const copy = COPY[kind];
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <h1 className="text-2xl font-extrabold">{copy.title}</h1>
      {copy.body && <p className="text-ink/70">{copy.body}</p>}
      {copy.cta && (
        <Link href="/" className="rounded-2xl bg-primary px-6 py-3 font-extrabold text-white">
          Crear una sala nueva
        </Link>
      )}
    </main>
  );
}
