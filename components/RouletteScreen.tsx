'use client';

import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { msUntil } from '@/lib/client/clock';
import { categoryName } from '@/lib/domain/categories';
import type { PhaseProps } from './RoomScreen';

const COLORS = ['#FF5722', '#FFB300', '#E91E63'];
const LABEL_COLORS = ['text-white', 'text-ink', 'text-white'];
const TURNS = 6;

export function RouletteScreen({ snapshot }: PhaseProps) {
  const roulette = snapshot.round!.roulette!;
  const [done, setDone] = useState(false);
  const segment = 360 / roulette.segments.length;
  const winnerIndex = roulette.segments.indexOf(roulette.winner);
  // Gira en sentido horario hasta dejar el centro del segmento ganador bajo la flecha (arriba).
  const target = 360 * TURNS + (360 - (winnerIndex + 0.5) * segment);
  // Se calcula una vez: quien entra tarde ve una animación más corta.
  const duration = useMemo(() => Math.max(1.5, msUntil(roulette.endsAt) / 1000 - 0.8), [roulette.endsAt]);
  const background = `conic-gradient(${roulette.segments
    .map((_, i) => `${COLORS[i % COLORS.length]} ${i * segment}deg ${(i + 1) * segment}deg`)
    .join(', ')})`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center overflow-x-hidden justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-black">¡A la ruleta!</h1>
      <p className="text-ink/70">Está re parejo. Que decida la suerte.</p>
      <div className="relative size-72">
        <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 text-4xl" aria-hidden>
          ▼
        </span>
        <motion.div
          className="relative size-full rounded-full border-8 border-white shadow-xl"
          style={{ background }}
          initial={{ rotate: 0 }}
          animate={{ rotate: target }}
          transition={{ duration, ease: [0.12, 0.8, 0.2, 1] }}
          onAnimationComplete={() => setDone(true)}
        >
          {roulette.segments.map((id, i) => {
            // Las etiquetas de la mitad izquierda se giran 180° para que se lean derechas.
            const angle = (i + 0.5) * segment;
            const flip = angle > 180;
            return (
              <span
                key={id}
                className={`absolute left-1/2 top-1/2 -ml-12 -mt-2.5 w-24 truncate text-sm font-extrabold leading-5 ${
                  flip ? 'text-right' : 'text-left'
                } ${LABEL_COLORS[i % LABEL_COLORS.length]}`}
                style={{ transform: `rotate(${angle - 90}deg) translateX(78px)${flip ? ' rotate(180deg)' : ''}` }}
              >
                {categoryName(id)}
              </span>
            );
          })}
        </motion.div>
      </div>
      <div className="h-8" aria-live="polite">
        {done && <p className="text-2xl font-black text-primary">¡Salió {categoryName(roulette.winner)}!</p>}
      </div>
    </main>
  );
}
