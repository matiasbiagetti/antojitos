'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { avatarChar, avatarSrc } from '@/lib/domain/avatar-defaults';
import { AVATAR_CATEGORIES, avatarCategoryOf } from '@/lib/domain/avatars';

/** Hoja inferior con todos los avatares por pestaña. Se carga con import() dinámico al abrirla. */
export function AvatarPicker({
  selected,
  onSelect,
  onClose,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(() => avatarCategoryOf(selected) ?? AVATAR_CATEGORIES[0].id);
  const category = AVATAR_CATEGORIES.find((c) => c.id === tab) ?? AVATAR_CATEGORIES[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Elegí tu avatar"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-background shadow-xl"
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="font-extrabold">Elegí tu avatar</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="px-2 text-2xl leading-none">
            ✕
          </button>
        </div>
        <div role="tablist" className="flex gap-1 overflow-x-auto px-2 py-2">
          {AVATAR_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === tab}
              aria-label={c.label}
              onClick={() => setTab(c.id)}
              className={`shrink-0 rounded-xl p-2 ${c.id === tab ? 'bg-secondary/30' : ''}`}
            >
              <Image src={avatarSrc(c.icon)} alt="" width={28} height={28} unoptimized />
            </button>
          ))}
        </div>
        <div key={tab} role="tabpanel" aria-label={category.label} className="grid flex-1 grid-cols-7 content-start gap-1 overflow-y-auto px-2 pb-4">
          {category.avatars.map((id) => (
            <button
              key={id}
              type="button"
              aria-label={avatarChar(id)}
              aria-pressed={id === selected}
              onClick={() => onSelect(id)}
              className={`flex aspect-square items-center justify-center rounded-xl ${id === selected ? 'bg-primary/20 ring-2 ring-primary' : ''}`}
            >
              <Image src={avatarSrc(id)} alt="" width={40} height={40} loading="lazy" unoptimized />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
