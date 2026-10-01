'use client';

import { useEffect, useState } from 'react';
import { msUntil } from '@/lib/client/clock';

// `key={until}` reinicia el estado al cambiar la deadline (evita setState sincronico en el efecto).
export function Countdown({ until }: { until: string }) {
  return <CountdownInner key={until} until={until} />;
}

function CountdownInner({ until }: { until: string }) {
  const [ms, setMs] = useState(() => msUntil(until));
  useEffect(() => {
    const id = setInterval(() => setMs(msUntil(until)), 250);
    return () => clearInterval(id);
  }, [until]);
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return (
    <span
      aria-label={`Quedan ${seconds} segundos`}
      className={`text-2xl font-black tabular-nums ${seconds <= 10 ? 'text-accent' : 'text-ink'}`}
    >
      {seconds}s
    </span>
  );
}
