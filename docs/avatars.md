# Avatares

Imágenes de emojis de Apple (PNG 64 px) tomadas del paquete npm
[`emoji-datasource-apple`](https://github.com/iamcal/emoji-data) 16.0.0.

**Licencia:** el código del paquete es MIT, pero el arte de los emojis es de Apple Inc. y **no
tiene licencia libre**. Usarlo fue una decisión del producto con el riesgo aceptado
(`docs/product-spec.md` §8). Para reemplazarlo por otro set, cambiar la fuente en
`scripts/build-avatars.mjs` y volver a correrlo.

## Regenerar

    node scripts/build-avatars.mjs

Genera `public/avatars/<id>.png`, `lib/domain/avatars.json` (pestañas y orden) y
`lib/domain/avatar-defaults.json` (ids elegibles como default al azar). Filtros: sin categoría
`Component`, sin emojis obsoletos, sin variantes de género ni de tono de piel.
