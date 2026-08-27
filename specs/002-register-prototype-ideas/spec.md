# Feature Specification: Registro de ideas de prototipos

**Feature Branch**: `002-register-prototype-ideas`

**Created**: 2026-08-25

**Status**: Draft

**Input**: Registrar ideas de prototipos mecatrónicos asociadas a un estudiante y solicitar la generación de su lista de materiales.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar una idea de prototipo (Priority: P1)

Como estudiante autenticado, quiero registrar el nombre y la descripción de una idea de prototipo mecatrónico para conservarla en mi espacio académico.

**Why this priority**: La idea registrada es el dato principal del módulo y el punto de partida para planificar materiales y trabajo posterior.

**Independent Test**: Un estudiante autenticado envía un nombre y una descripción válidos; el sistema crea una única idea, asigna su propietario y fecha, y devuelve su identificador.

**Acceptance Scenarios**:

1. **Given** un estudiante autenticado y datos válidos, **When** registra una idea, **Then** la idea queda almacenada con un identificador, la fecha actual y la identidad del estudiante.
2. **Given** una solicitud sin nombre, sin descripción o con datos fuera de los límites admitidos, **When** intenta registrarla, **Then** el sistema la rechaza con errores de validación y no crea una idea.

---

### User Story 2 - Proteger la propiedad de la idea (Priority: P1)

Como estudiante autenticado, quiero que una idea solo pueda registrarse a mi nombre para impedir que otra persona me atribuya proyectos o use mi identidad.

**Why this priority**: La propiedad correcta es necesaria para proteger los recursos académicos personales y reutilizar el contexto de identidad establecido por el sistema.

**Independent Test**: Una solicitud que contiene un identificador distinto al de la sesión autenticada es rechazada y no crea ningún proyecto.

**Acceptance Scenarios**:

1. **Given** un estudiante autenticado, **When** el identificador declarado coincide con su sesión, **Then** el sistema registra la idea para ese estudiante.
2. **Given** un estudiante autenticado, **When** intenta declarar el identificador de otro estudiante, **Then** el sistema rechaza la solicitud sin revelar datos ajenos.
3. **Given** un visitante sin sesión, **When** intenta registrar una idea, **Then** el sistema niega el acceso y no guarda información.

---

### User Story 3 - Solicitar la lista de materiales (Priority: P2)

Como estudiante, quiero que el sistema solicite automáticamente la generación de una lista de materiales después de registrar mi idea para iniciar su planificación técnica.

**Why this priority**: La lista de materiales convierte una descripción conceptual en insumos útiles, pero depende de que primero exista una idea identificable.

**Independent Test**: Después de almacenar una idea válida, se verifica que se solicite una vez la generación de materiales usando el identificador creado y la descripción registrada.

**Acceptance Scenarios**:

1. **Given** una idea almacenada correctamente, **When** finaliza el registro, **Then** el sistema solicita exactamente una vez su lista de materiales con el identificador y la descripción correctos.
2. **Given** una solicitud inválida o rechazada por propiedad, **When** termina su procesamiento, **Then** no se solicita ninguna lista de materiales.
3. **Given** un fallo al solicitar la lista de materiales, **When** se procesa el registro, **Then** el sistema no confirma éxito ni deja un registro parcial que el estudiante interprete como completo.

### Edge Cases

- El nombre o la descripción solo contienen espacios.
- El nombre o la descripción exceden los límites admitidos por la persistencia.
- El identificador declarado es cero, negativo, inexistente o distinto al de la sesión.
- Se reciben dos solicitudes equivalentes; cada solicitud válida representa una idea independiente porque no se definió una regla de unicidad de contenido.
- La persistencia falla antes de obtener el identificador de la idea.
- La solicitud de generación de materiales falla después de preparar el registro.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir que un estudiante autenticado registre una idea proporcionando nombre, descripción e identificador de estudiante.
- **FR-002**: El sistema MUST validar obligatoriedad, espacios en blanco, longitud de nombre y longitud de descripción antes de almacenar la idea.
- **FR-003**: El sistema MUST comprobar que el identificador declarado sea positivo y coincida con la identidad autenticada; el valor del cliente no puede sustituir la identidad de la sesión.
- **FR-004**: El sistema MUST asignar automáticamente una fecha de creación en tiempo universal.
- **FR-005**: El sistema MUST almacenar cada idea válida con un identificador generado y su propietario autenticado.
- **FR-006**: El sistema MUST solicitar exactamente una vez la generación de la lista de materiales después de obtener el identificador persistente de la idea, usando ese identificador y la descripción validada.
- **FR-007**: El sistema MUST mantener consistente el registro de la idea y la solicitud de materiales; ante un fallo no debe confirmar éxito ni dejar una operación parcialmente completada.
- **FR-008**: El sistema MUST devolver errores de validación o acceso seguros, sin exponer detalles internos ni información de otros estudiantes.
- **FR-009**: Una respuesta exitosa MUST identificar la idea creada, su nombre, descripción, propietario y fecha de creación.

### Key Entities

- **Proyecto**: Idea de prototipo mecatrónico con identificador, nombre, descripción, fecha de creación y estudiante propietario.
- **Lista de materiales del proyecto**: Conjunto de materiales asociado a una idea existente; su generación recibe el identificador y la descripción del proyecto.
- **Estudiante autenticado**: Propietario derivado de la sesión que autoriza el registro y no puede ser reemplazado por datos enviados por el cliente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las solicitudes válidas crea una única idea con propietario y fecha asignados correctamente.
- **SC-002**: El 100% de las solicitudes con datos inválidos o identidad manipulada se rechaza sin crear ideas ni solicitar materiales.
- **SC-003**: El 100% de las ideas confirmadas solicita exactamente una generación de lista de materiales con el identificador y la descripción correctos.
- **SC-004**: Ante fallos simulados de almacenamiento o generación, el 100% de las operaciones responde sin éxito y no deja registros parciales confirmados.
- **SC-005**: En condiciones locales normales, un estudiante recibe la confirmación del registro en menos de dos segundos, excluyendo cualquier procesamiento futuro de materiales fuera de esta entrega.

## Assumptions

- El sistema de sesión y el contexto de identidad de estudiantes ya existentes se reutilizan.
- La tabla de proyectos y su relación con estudiantes existen o se adaptan mediante un cambio de esquema no destructivo acorde con el modelo vigente del repositorio.
- El contrato para generar materiales se incluye en esta entrega; las reglas reales de selección y cantidad de materiales quedan fuera de alcance y se representan mediante una implementación base sin resultados.
- No se incluye consulta, edición, eliminación ni detección de ideas duplicadas.
- El nombre admite hasta 150 caracteres y la descripción hasta 4000 caracteres como límites seguros de entrada, salvo que el esquema vigente imponga un límite menor.
