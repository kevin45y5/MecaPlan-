# Investigación técnica: SP2

## Decisión 1: Generación local por palabras clave

**Decisión**: Usar un catálogo fijo de términos y componentes; contar menciones en la descripción normalizada.

**Rationale**: Cumple la generación inmediata solicitada y es fácil de explicar y probar en un proyecto académico.

**Alternativas descartadas**: IA externa por costos, red y complejidad; generación manual porque no cumple la automatización.

## Decisión 2: Operación consistente

**Decisión**: Persistir proyecto y BOM en una operación de guardado.

**Rationale**: Evita resultados parciales.

## Decisión 3: Propiedad

**Decisión**: Obtener `StudentId` exclusivamente mediante `ICurrentStudentContext` de SP1.
