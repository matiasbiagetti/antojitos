# CLAUDE.md

## Fuente de verdad

`docs/product-spec.md` es la fuente de verdad del producto Antojitos. Toda spec, diseño,
plan o código debe ser consistente con ese documento. Si algo no está cubierto o parece
contradictorio, preguntar antes de asumir.

## Secciones [A CONFIRMAR]

Las decisiones marcadas como **[A CONFIRMAR]** en el spec son propuestas, no definiciones.
No implementarlas sin validarlas antes con el usuario (típicamente vía brainstorm). Una vez
cerradas, actualizar el spec reemplazando el [A CONFIRMAR] por la decisión tomada.

## Cambios de fondo

Si durante el trabajo surge una decisión que cambia algo estructural del producto (alcance,
mecánica de votación, reglas de sesión, modelo de resultado, etc.), proponer explícitamente
actualizar `docs/product-spec.md` antes de seguir. El código no se adelanta al spec.

## Alcance

Respetar estrictamente la sección 3 del spec. Lo listado como "Fuera de la POC"
(filtros dietéticos, modalidades, platos/restaurantes específicos, votación de postre,
cuentas, historial, monetización) no se implementa, aunque parezca una mejora natural.
