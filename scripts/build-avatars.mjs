// Genera el catálogo de avatares desde emoji-datasource-apple. Se corre a mano: node scripts/build-avatars.mjs
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve('emoji-datasource-apple/package.json'));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// [categoría del paquete, id, label]; el orden es el de las pestañas.
const CATEGORIES = [
  ['Smileys & Emotion', 'smileys-emotion', 'Caritas'],
  ['People & Body', 'people-body', 'Personas'],
  ['Animals & Nature', 'animals-nature', 'Animales'],
  ['Food & Drink', 'food-drink', 'Comida'],
  ['Travel & Places', 'travel-places', 'Viajes'],
  ['Activities', 'activities', 'Actividades'],
  ['Objects', 'objects', 'Objetos'],
  ['Symbols', 'symbols', 'Símbolos'],
  ['Flags', 'flags', 'Banderas'],
];
const DEFAULT_CATEGORIES = ['smileys-emotion', 'animals-nature', 'food-drink'];
const GENDERED = /-200D-264[02]/;

const emojis = JSON.parse(await readFile(path.join(pkgDir, 'emoji.json'), 'utf8'));
const byName = new Map(CATEGORIES.map(([name]) => [name, []]));
for (const e of [...emojis].sort((a, b) => a.sort_order - b.sort_order)) {
  if (!e.has_img_apple || e.obsoleted_by || GENDERED.test(e.unified)) continue;
  byName.get(e.category)?.push(e.image); // Component y cualquier otra categoría quedan afuera
}

const outDir = path.join(root, 'public', 'avatars');
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const categories = [];
for (const [name, id, label] of CATEGORIES) {
  const images = byName.get(name);
  for (const image of images) {
    await copyFile(path.join(pkgDir, 'img', 'apple', '64', image), path.join(outDir, image));
  }
  const avatars = images.map((image) => image.replace(/\.png$/, ''));
  categories.push({ id, label, icon: avatars[0], avatars });
}

await writeFile(path.join(root, 'lib', 'domain', 'avatars.json'), JSON.stringify({ categories }) + '\n');
const defaults = categories.filter((c) => DEFAULT_CATEGORIES.includes(c.id)).flatMap((c) => c.avatars);
await writeFile(path.join(root, 'lib', 'domain', 'avatar-defaults.json'), JSON.stringify(defaults) + '\n');
console.log(categories.map((c) => `${c.id}: ${c.avatars.length}`).join('\n'));
