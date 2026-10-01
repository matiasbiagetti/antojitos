import type { CategoryId } from './types';

export const CATEGORIES: readonly { id: CategoryId; name: string }[] = [
  { id: 'pizza', name: 'Pizza' },
  { id: 'burgers', name: 'Hamburguesas' },
  { id: 'sushi', name: 'Sushi' },
  { id: 'pasta', name: 'Pastas' },
  { id: 'empanadas', name: 'Empanadas' },
  { id: 'grill', name: 'Parrilla' },
  { id: 'milanesa', name: 'Milanesas' },
  { id: 'middle_eastern', name: 'Comida árabe' },
  { id: 'mexican', name: 'Mexicana' },
  { id: 'chinese', name: 'China' },
  { id: 'peruvian', name: 'Peruana' },
  { id: 'chicken', name: 'Pollo' },
  { id: 'sandwiches', name: 'Sándwiches' },
  { id: 'veggie', name: 'Veggie / Saludable' },
];

export const CATEGORY_IDS: readonly CategoryId[] = CATEGORIES.map((c) => c.id);

const NAMES = new Map(CATEGORIES.map((c) => [c.id, c.name]));

export function categoryName(id: CategoryId): string {
  return NAMES.get(id) ?? id;
}

export function categoryImage(id: CategoryId): string {
  return `/categories/${id}.webp`;
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && NAMES.has(value as CategoryId);
}
