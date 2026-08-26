# Evidencia de validación — SP2

## Resultado local

- Compilación de la solución: correcta, sin advertencias ni errores.
- Pruebas de aplicación: cubren asociación de proyecto al estudiante autenticado y validación de campos.
- Prueba de infraestructura: cubre reconocimiento y conteo del catálogo local de BOM.
- Prueba web: cubre visitante redirigido, formulario protegido y redirección al resultado tras enviar una idea.

## Cobertura de criterios

| Criterio | Evidencia |
|---|---|
| Guardar nombre y descripción | `ProjectIdeaServiceTests` y `ProjectsController`. |
| Fecha y EstudianteID automáticos | Entidad `Proyecto`, repositorio y migración SP2. |
| Generar y poblar BOM al enviar | `KeywordBomGenerator`, `ProyectoRepository` y prueba de catálogo. |
| Propiedad | `ICurrentStudentContext` y consulta `FindOwnedAsync`. |
