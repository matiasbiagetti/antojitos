'use client';

import { useEffect } from 'react';

/** Starts downloading `urls` in order so later cards are already cached when they mount. */
export function usePreloadImages(urls: readonly string[]) {
  const key = urls.join('|');
  useEffect(() => {
    if (!key) return;
    // Keep references so the requests aren't garbage-collected mid-flight.
    const images = key.split('|').map((src) => {
      const img = new window.Image();
      img.src = src;
      return img;
    });
    return () => {
      images.length = 0;
    };
  }, [key]);
}
