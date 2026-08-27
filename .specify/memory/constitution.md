<!--
Sync Impact Report
- Version change: 1.1.0 -> 2.0.0
- Modified principles: specification-first, security, quality, and delivery governance.
- Added sections: Academic scope and lightweight local development workflow.
- Removed sections: enterprise-only operational and AI-delivery obligations not needed by SPs.
- Deferred items: Update the active SP specification, plan, tasks, and quickstart to this governance.
-->

# Constitución de MecaPlan

## Principios fundamentales

### I. Alcance académico y simplicidad deliberada

MecaPlan es un proyecto institucional educativo. Cada SP MUST resolver una necesidad académica
con el menor diseño que la haga clara, demostrable y mantenible. No se exigirán despliegues,
observabilidad empresarial, alta disponibilidad ni integraciones externas salvo que un SP los
incluya expresamente. Las decisiones locales MUST favorecer que el equipo pueda ejecutar el
proyecto con .NET, SQL Server Express y una guía breve.

### II. Especificación ligera antes de cambios funcionales

Todo SP o cambio funcional material MUST tener una especificación, plan y tareas breves en
`specs/` antes de implementar. Correcciones de configuración, documentación o desarrollo local
pueden realizarse sin crear un SP nuevo si no cambian reglas de negocio, datos, autorización o
contratos; deben quedar documentadas y verificadas. El propietario MUST autorizar los cambios
de código o datos antes de aplicarlos.

### III. Capas y datos claros

La solución MUST mantenerse como ASP.NET Core MVC sobre .NET 10, con responsabilidades separadas
entre presentación, aplicación, dominio e infraestructura. SQL Server es la persistencia del
proyecto y las operaciones de datos MUST usar EF Core, repositorios o consultas parametrizadas.
Los cambios de esquema MUST tener migración o script idempotente y no destruir datos existentes.

### IV. Seguridad proporcional

Contraseñas, cadenas de conexión y secretos MUST permanecer fuera del repositorio y las
contraseñas MUST usar hashes fuertes. Las rutas y datos personales MUST respetar autenticación y
propiedad cuando el SP lo requiera. En Development se permite HTTP en localhost para evitar que
certificados locales bloqueen el trabajo; producción MUST usar HTTPS, cookies seguras y manejo de
errores seguro. No se almacenarán secretos reales en pruebas, documentación ni trazas.

### V. Calidad útil y verificable

Todo cambio MUST compilar sin errores y ejecutar las pruebas aplicables. Una regla de negocio o
seguridad nueva MUST tener una prueba automatizada cuando sea razonable; los flujos web críticos
MUST tener una prueba web o evidencia manual reproducible. Los errores locales MUST incluir una
guía accionable para que otra persona del equipo pueda resolverlos.

## Alcance académico y documentación

Cada SP MUST declarar qué incluye, qué no incluye y cómo comprobarlo. La documentación debe estar
en español claro e incluir: requisitos locales, configuración de secretos por usuario, comando de
arranque, URL local y pasos de prueba. Los módulos futuros de proyectos, BOM, inventario,
diagnóstico o IA se especificarán en sus propios SPs; no se implementarán por anticipado.

## Flujo de desarrollo local

El flujo estándar MUST ser restaurar, configurar el secreto local, aplicar la migración requerida,
compilar, ejecutar pruebas y arrancar el perfil `http`. La URL de Development es
`http://localhost:5180`. Cada integrante usa su propia base y secretos; una base compartida o de
producción no se usa para pruebas. HTTPS local es opcional para Development y obligatorio solo en
entornos no Development.

## Gobernanza

Esta constitución guía las especificaciones, planes, tareas, implementación y revisión. Una
excepción relevante MUST documentar el motivo, impacto y mitigación en el SP afectado. Las
enmiendas requieren aprobación explícita del propietario y actualización de este documento.

El versionado es semántico: MAJOR redefine principios, MINOR añade obligaciones y PATCH aclara
texto. Antes de entregar un SP, el equipo MUST comprobar que sus tareas verificadas, pruebas y
documentación coincidan con el alcance realmente implementado.

**Versión**: 2.0.0 | **Ratificada**: 2026-08-24 | **Última enmienda**: 2026-08-25
