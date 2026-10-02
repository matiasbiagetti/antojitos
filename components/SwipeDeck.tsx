'use client';

import Image from 'next/image';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import { classifySwipe, hintFor } from '@/lib/client/swipe';
import { categoryImage, categoryName } from '@/lib/domain/categories';
import type { CategoryId, VoteValue } from '@/lib/domain/types';

const HINT_LABEL: Record<VoteValue, string> = { yes: 'ME VA', no: 'PASO', super: '¡SÚPER ANTOJO!' };
const HINT_STYLE: Record<VoteValue, string> = {
  yes: 'left-4 top-6 -rotate-12 border-secondary text-secondary',
  no: 'right-4 top-6 rotate-12 border-ink text-ink',
  super: 'inset-x-0 bottom-24 mx-auto w-fit border-accent text-accent',
};

export function SwipeDeck({
  categoryId,
  superAvailable,
  onVote,
  onSuperBlocked,
}: {
  categoryId: CategoryId;
  superAvailable: boolean;
  onVote: (value: VoteValue) => void;
  onSuperBlocked: () => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  const [hint, setHint] = useState<VoteValue | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const busy = useRef(false);

  const springBack = () => {
    void animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    void animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 });
  };

  async function commit(value: VoteValue) {
    if (busy.current) return;
    if (value === 'super' && !superAvailable) {
      setHint(null);
      springBack();
      onSuperBlocked();
      return;
    }
    busy.current = true;
    if (value === 'super') await animate(y, -900, { duration: 0.25 });
    else await animate(x, value === 'yes' ? 600 : -600, { duration: 0.25 });
    onVote(value);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-x-hidden">
      <div className="flex min-h-0 w-full flex-1 justify-center">
        <div className="relative h-full max-w-full aspect-[3/4]">
        <motion.div
          data-testid="card"
          data-category-id={categoryId}
          drag
          style={{ x, y, rotate }}
          onDrag={(_, info) => {
            const next = hintFor(info.offset);
            setHint(next === 'super' && !superAvailable ? null : next);
          }}
          onDragEnd={(_, info) => {
            setHint(null);
            const value = classifySwipe(info.offset, info.velocity);
            if (value) void commit(value);
            else springBack();
          }}
          className="absolute inset-0 cursor-grab touch-none select-none overflow-hidden rounded-3xl bg-secondary shadow-xl active:cursor-grabbing"
        >
          {!imageFailed && (
            <Image
              src={categoryImage(categoryId)}
              alt=""
              fill
              sizes="(max-width: 448px) 100vw, 384px"
              draggable={false}
              priority
              onError={() => setImageFailed(true)}
              className="pointer-events-none object-cover"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-5 pt-16">
            <h2 className="text-3xl font-black text-white">{categoryName(categoryId)}</h2>
          </div>
          {hint && (
            <span className={`absolute rounded-xl border-4 bg-white/90 px-3 py-1 text-2xl font-black ${HINT_STYLE[hint]}`}>
              {HINT_LABEL[hint]}
            </span>
          )}
        </motion.div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-6 pb-1">
        <button
          type="button"
          aria-label="Paso"
          onClick={() => void commit('no')}
          className="grid size-16 place-items-center rounded-full bg-white text-3xl shadow-md active:scale-95"
        >
          ✗
        </button>
        <button
          type="button"
          aria-label="Súper antojo"
          aria-disabled={!superAvailable}
          onClick={() => void commit('super')}
          className={`grid size-20 place-items-center rounded-full text-4xl shadow-lg active:scale-95 ${
            superAvailable ? 'bg-accent text-white' : 'bg-ink/10 text-ink/30'
          }`}
        >
          ⭐
        </button>
        <button
          type="button"
          aria-label="Me va"
          onClick={() => void commit('yes')}
          className="grid size-16 place-items-center rounded-full bg-white text-3xl text-primary shadow-md active:scale-95"
        >
          ✓
        </button>
      </div>
    </div>
  );
}
