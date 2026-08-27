# Investigación: Registro de ideas de prototipos

## Decisión 1: Propiedad derivada de la sesión

**Decisión**: Conservar `EstudianteID` en el DTO solicitado, exigir autenticación y aceptar la operación únicamente si ese valor coincide con `ICurrentStudentContext.StudentId`. La entidad se construye siempre con el valor del contexto.

**Rationale**: Mantiene compatibilidad con el contrato pedido sin permitir suplantación de propietario y respeta el patrón de seguridad ya establecido por SP1.

**Alternatives considered**:

- Confiar directamente en el DTO: descartado porque permitiría crear proyectos para otro estudiante.
- Eliminar el campo del DTO: más seguro y simple, pero no cumple el contrato de entrada explícitamente solicitado.

## Decisión 2: Coordinación transaccional

**Decisión**: Introducir `IProyectoCreationService`; su implementación usa el contexto existente, guarda para obtener `ProyectoID`, invoca `IBomService` y confirma una transacción solo cuando ambas operaciones finalizan.

**Rationale**: Evita que el controlador dependa de EF Core y evita confirmar un proyecto como completo cuando la generación de BOM falla. Una futura implementación de BOM resuelta en el mismo alcance de dependencias participa en la misma transacción SQL.

**Alternatives considered**:

- Persistir directamente en el controlador: descartado por mezclar presentación e infraestructura y dificultar pruebas.
- Guardar y compensar con una eliminación si BOM falla: descartado porque la compensación también puede fallar.

## Decisión 3: Compatibilidad con el esquema vigente

**Decisión**: Mantener la tabla `Proyectos.Proyectos`, usar las propiedades de dominio `Nombre` y `Descripcion`, y agregar una migración idempotente que crea la tabla cuando falta o renombra sin pérdida las columnas heredadas `NombreProyecto`/`DescripcionIdea` cuando corresponda.

**Rationale**: El requerimiento actual usa `Nombre`/`Descripcion`, mientras el script histórico del repositorio contiene nombres anteriores. La adaptación permite bases nuevas y existentes sin borrar datos.

**Alternatives considered**:

- Mapear permanentemente a nombres heredados: descartado porque contradice el contrato de datos actual.
- Crear una tabla paralela: descartado porque duplicaría proyectos y rompería relaciones existentes.

## Decisión 4: Implementación inicial de BOM

**Decisión**: `IBomService` expone `GenerarBomAsync(int proyectoId, string descripcion, CancellationToken)` y `DummyBomService` finaliza sin crear materiales.

**Rationale**: Cumple la integración pedida y deja un punto de extensión comprobable sin inventar reglas de selección, cantidades o componentes no especificadas.

**Alternatives considered**:

- Generar filas ficticias: descartado porque produciría datos académicos engañosos.
- Omitir la invocación: descartado porque es parte explícita de la historia.
