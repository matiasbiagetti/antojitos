'use client';

import Image from 'next/image';
import { useState } from 'react';
import { categoryImage } from '@/lib/domain/categories';
import type { CategoryId } from '@/lib/domain/types';

/** Category photo served as-is (already compressed WebP) with a neutral placeholder until it loads. */
export function CategoryPhoto({
  categoryId,
  sizes,
  priority,
  draggable,
  className = '',
}: {
  categoryId: CategoryId;
  sizes: string;
  priority?: boolean;
  draggable?: boolean;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <>
      {!loaded && <div aria-hidden className="absolute inset-0 animate-pulse bg-ink/10" />}
      <Image
        ref={(img) => {
          if (img?.complete && img.naturalWidth > 0) setLoaded(true);
        }}
        src={categoryImage(categoryId)}
        alt=""
        fill
        unoptimized
        sizes={sizes}
        priority={priority}
        draggable={draggable}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`object-cover ${className}`}
      />
    </>
  );
}
