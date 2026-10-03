# Fotos de categoría más apetitosas — Plan de implementación

**Spec:** `docs/product-spec.md` §5.2 y decisión 6 (actualizados en `de50f47`): las fotos se eligen
por lo apetitosas que se ven, aunque no tengan licencia libre; se guardan en el proyecto,
optimizadas para mobile, y se registra la fuente de cada una.

**Objetivo:** reemplazar 11 de las 14 fotos de categoría por las candidatas aprobadas por el
usuario. `burgers`, `empanadas` y `mexican` no cambian.

## Global Constraints

- Las fotos siguen en `public/categories/<id>.webp`, 720x960, ≤ 90 KB (lo que ya hace
  `scripts/convert-photos.mjs`). `lib/domain/categories.ts` no se toca.
- No se regeneran las 3 fotos que no cambian (`burgers`, `empanadas`, `mexican`): sus `.webp`
  deben quedar byte a byte iguales.
- Identificadores en inglés, comentarios y documentación en español (convención del repo).
- Nada fuera del alcance: no se agrega UI de créditos ni se tocan componentes.

## Task 1: Manifest nuevo y regeneración de las 11 fotos

**Files:**
- Modify: `scripts/category-photos.json`
- Modify: `scripts/convert-photos.mjs`
- Modify (generados): `public/categories/{pizza,grill,milanesa,peruvian,sushi,chicken,chinese,middle_eastern,pasta,sandwiches,veggie}.webp`

**Interfaz:** `scripts/category-photos.json` sigue siendo
`Record<CategoryId, { imageUrl: string; pageUrl: string; author: string; source: string }>`.
`source` pasa a admitir `"web"` además de `"unsplash"`; `author` es el sitio de origen cuando no
hay autor individual.

- [ ] **Step 1: Reemplazar estas 11 entradas en `scripts/category-photos.json`** (las de
  `burgers`, `empanadas` y `mexican` quedan idénticas; mantener el orden de claves actual):

```json
"pizza": {
  "imageUrl": "https://www.seriouseats.com/thmb/xiXNRtRcipa1zSjmKO4iGdM0b24=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/__opt__aboutcom__coeus__resources__content_migration__serious_eats__seriouseats.com__images__2017__04__20170411-pizza-oven-testing-roccbox-best-c7f2acbecbb047c0b3b74e1835a77f03.jpg",
  "pageUrl": "https://www.seriouseats.com/basic-neapolitan-pizza-dough-recipe",
  "author": "Serious Eats",
  "source": "web"
},
"sushi": {
  "imageUrl": "https://sodelicious.recipes/wp-content/uploads/2018/10/13.07.2018-R-4-lat-50-sushi-Sushi-Party-Platter-720x720.jpg",
  "pageUrl": "https://sodelicious.recipes/recipe/party-sushi-platter/",
  "author": "So Delicious",
  "source": "web"
},
"pasta": {
  "imageUrl": "https://www.recipetineats.com/tachyon/2018/07/Spaghetti-Bolognese.jpg",
  "pageUrl": "https://www.recipetineats.com/spaghetti-bolognese/",
  "author": "RecipeTin Eats",
  "source": "web"
},
"grill": {
  "imageUrl": "https://rapirecetas.com/assets/images/2026/08/asado-argentino_1500x1000.webp",
  "pageUrl": "https://rapirecetas.com/asado-argentino/",
  "author": "Rapirecetas",
  "source": "web"
},
"milanesa": {
  "imageUrl": "https://www.finedininglovers.es/sites/default/files/recipe_content_images/Milanesa%20a%20la%20Napolitana.jpg",
  "pageUrl": "https://www.finedininglovers.com/es/recetas/platos-principales/milanesa-a-la-napolitana",
  "author": "Fine Dining Lovers",
  "source": "web"
},
"middle_eastern": {
  "imageUrl": "https://playswellwithbutter.com/wp-content/uploads/2021/03/Hummus-Bowls-15.jpg",
  "pageUrl": "https://playswellwithbutter.com/hummus-bowls-recipe/",
  "author": "Plays Well With Butter",
  "source": "web"
},
"chinese": {
  "imageUrl": "https://www.recipetineats.com/tachyon/2019/06/Chow-Mein-Ramen_3.jpg",
  "pageUrl": "https://www.recipetineats.com/chow-mein/",
  "author": "RecipeTin Eats",
  "source": "web"
},
"peruvian": {
  "imageUrl": "https://www.saveur.com/uploads/2019/01/24/KHZNIHIIO5TBH6P5H2BWHRPRA4.jpg?auto=webp",
  "pageUrl": "https://www.saveur.com/peru-street-cart-ceviche-recipe",
  "author": "Saveur",
  "source": "web"
},
"chicken": {
  "imageUrl": "https://www.recipetineats.com/tachyon/2016/05/Roast-Chicken_6a.jpg",
  "pageUrl": "https://www.recipetineats.com/roast-chicken/",
  "author": "RecipeTin Eats",
  "source": "web"
},
"sandwiches": {
  "imageUrl": "https://www.recipetineats.com/tachyon/2017/01/Steak-Sandwich-9.jpg",
  "pageUrl": "https://www.recipetineats.com/steak-sandwich/",
  "author": "RecipeTin Eats",
  "source": "web"
},
"veggie": {
  "imageUrl": "https://www.eatingbirdfood.com/wp-content/uploads/2022/04/buddha-bowl-hero.jpg",
  "pageUrl": "https://www.eatingbirdfood.com/buddha-bowl/",
  "author": "Eating Bird Food",
  "source": "web"
}
```

- [ ] **Step 2: Permitir convertir sólo algunas categorías en `scripts/convert-photos.mjs`.**
  Si se pasan ids como argumentos (`node scripts/convert-photos.mjs pizza grill`), convierte sólo
  esos; sin argumentos convierte todas, como hoy. Un id que no está en el manifest corta con
  error (`Error: <id>: no está en category-photos.json`). Además, algunos sitios rechazan
  pedidos sin user-agent de navegador: mandar
  `headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36' }`
  en el `fetch`. Actualizar el comentario de la primera línea para mencionar los argumentos.

- [ ] **Step 3: Regenerar las 11 fotos**

Run: `node scripts/convert-photos.mjs pizza grill milanesa peruvian sushi chicken chinese middle_eastern pasta sandwiches veggie`
Expected: 11 líneas `<id>: <N> KB`, cada N ≤ 90.

- [ ] **Step 4: Verificar**

Run: `git status --short public/categories` → exactamente los 11 `.webp` modificados; `burgers`,
`empanadas` y `mexican` no aparecen.
Run: `node -e "const s=require('sharp');for(const f of require('fs').readdirSync('public/categories'))s('public/categories/'+f).metadata().then(m=>console.log(f,m.width,m.height,m.format))"`
Expected: los 14 archivos en `720 960 webp`.
Abrir 2 o 3 de los nuevos `.webp` y confirmar que el recorte deja la comida centrada.

- [ ] **Step 5: Commit**

```bash
git add scripts/category-photos.json scripts/convert-photos.mjs public/categories
git commit -m "feat(photos): replace 11 category photos with more appetizing ones"
```

## Task 2: Actualizar `docs/category-photos.md`

**Files:**
- Modify: `docs/category-photos.md`

- [ ] **Step 1:** Reemplazar el título y la línea de licencia por:

```markdown
# Fotos por categoría

Elegidas por lo apetitosas que se ven (ver `docs/product-spec.md` §5.2). Las de Unsplash tienen
Unsplash License; el resto tiene copyright de su sitio de origen y se usa sólo para la POC: antes
de un uso comercial hay que reemplazarlas.
```

- [ ] **Step 2:** En la tabla, cambiar el encabezado de `Autor` a `Autor / sitio`. Para las 11
  categorías de Task 1, la columna Vista previa usa `![<id>](<imageUrl>)`, la de Autor / sitio
  el `author` del manifest y Fuente es `[<author>](<pageUrl>)`, todo tomado de
  `scripts/category-photos.json`. Las filas de `burgers`, `empanadas` y `mexican` no cambian.
  Mantener el orden de filas actual.

- [ ] **Step 3: Commit**

```bash
git add docs/category-photos.md
git commit -m "docs: record sources of the new category photos"
```
