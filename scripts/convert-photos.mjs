// Descarga las fotos aprobadas (scripts/category-photos.json) y las guarda como WebP 720x960.
import { mkdir, readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';

const photos = JSON.parse(await readFile(new URL('./category-photos.json', import.meta.url), 'utf8'));
await mkdir('public/categories', { recursive: true });

for (const [id, { imageUrl }] of Object.entries(photos)) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  const out = `public/categories/${id}.webp`;
  const resized = sharp(Buffer.from(await res.arrayBuffer())).resize(720, 960, { fit: 'cover', position: 'attention' });
  // Baja la calidad de a 6 puntos hasta que la foto pese <= 90 KB.
  for (let quality = 68; ; quality -= 6) {
    await resized.clone().webp({ quality }).toFile(out);
    if ((await stat(out)).size <= 90 * 1024 || quality <= 30) break;
  }
  console.log(`${id}: ${Math.round((await stat(out)).size / 1024)} KB`);
}
