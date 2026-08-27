# Feature Specification: SP2 - Idea de prototipo y BOM automática

**Feature Branch**: `002-project-idea-bom`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "Como estudiante, quiero registrar la idea en texto de mi prototipo mecatrónico en la plataforma, para que el sistema procese automáticamente el diseño conceptual y genere de inmediato la lista de materiales requerida (BOM)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar una idea de prototipo (Priority: P1)

Un estudiante con sesión activa escribe el nombre y una descripción de su prototipo y los envía para conservar la idea en su cuenta.

**Why this priority**: Es el punto de partida del trabajo académico y permite asociar el prototipo a su dueño.

**Independent Test**: Un estudiante autenticado registra una idea válida y puede comprobar que quedó asociada solamente a su propia cuenta.

**Acceptance Scenarios**:

1. **Given** un estudiante autenticado, **When** completa nombre y descripción válidos y presiona Enviar, **Then** el sistema guarda una única idea asociada a su identidad y registra su fecha de creación.
2. **Given** un visitante sin sesión, **When** intenta abrir o enviar el formulario, **Then** es dirigido al inicio de sesión y no se guarda ninguna idea.
3. **Given** un estudiante autenticado, **When** omite el nombre o la descripción, **Then** recibe un error de campo y no se guarda la idea.

---

### User Story 2 - Recibir la lista de materiales inicial (Priority: P1)

Después de registrar la idea, el estudiante recibe una lista inicial de componentes técnicos identificados a partir de su descripción.

**Why this priority**: Cumple el valor principal de SP2: transformar la idea conceptual en una BOM útil para comenzar el prototipo.

**Independent Test**: Al enviar una descripción con términos de componentes conocidos, el estudiante recibe inmediatamente una BOM con esos componentes; una descripción sin términos conocidos conserva el proyecto sin producir componentes inventados.

**Acceptance Scenarios**:

1. **Given** una descripción que menciona componentes reconocidos, **When** el estudiante envía la idea, **Then** el sistema genera y guarda una entrada de BOM por cada componente reconocido.
2. **Given** una descripción sin componentes reconocidos, **When** el estudiante envía la idea, **Then** el sistema guarda el proyecto, informa que no se detectaron componentes y no agrega componentes no solicitados.
3. **Given** dos estudiantes distintos, **When** cada uno registra una idea, **Then** ninguno puede consultar ni alterar las ideas o BOM del otro.

### Edge Cases

- Una descripción contiene el mismo componente varias veces: la BOM conserva una sola entrada del componente y aumenta su cantidad según las menciones detectadas.
- La descripción contiene términos con mayúsculas, minúsculas o espacios adicionales: se reconocen de la misma forma.
- Ocurre un error al generar la BOM: la idea no queda registrada parcialmente y el estudiante recibe un mensaje general de error.
- El estudiante reenvía el formulario: cada envío explícito crea un proyecto nuevo; el sistema no reutiliza o modifica proyectos anteriores.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar a estudiantes autenticados un formulario con nombre de proyecto, descripción de la idea y botón Enviar.
- **FR-002**: El sistema MUST exigir un nombre y una descripción no vacíos antes de registrar una idea.
- **FR-003**: El sistema MUST guardar cada idea con un identificador propio, nombre, descripción, fecha de creación y el identificador del estudiante autenticado.
- **FR-004**: El sistema MUST tomar la identidad del estudiante únicamente de la sesión autenticada; no aceptará un identificador de estudiante enviado por el navegador.
- **FR-005**: Tras un registro válido, el sistema MUST procesar la descripción mediante el módulo local de generación de BOM y guardar los componentes técnicos identificados para ese proyecto.
- **FR-006**: El sistema MUST generar la BOM únicamente a partir de un catálogo académico fijo de términos y componentes; no inventará componentes cuando no pueda identificarlos.
- **FR-007**: Cada entrada de BOM MUST estar asociada a un único proyecto, incluir el componente identificado y una cantidad positiva.
- **FR-008**: El sistema MUST impedir que un estudiante vea o modifique ideas y BOM asociadas a otro estudiante.
- **FR-009**: Si no se identifican componentes, el sistema MUST conservar la idea y comunicar el resultado sin mostrar un error técnico.
- **FR-010**: Si el registro o la generación no pueden completarse de forma consistente, el sistema MUST no guardar resultados parciales y mostrar un mensaje seguro.

### Key Entities *(include if feature involves data)*

- **Proyecto**: Idea de prototipo creada por un estudiante; contiene nombre, descripción, fecha de creación y propietario.
- **Entrada de BOM**: Componente técnico inicial identificado para una idea; contiene proyecto asociado, componente y cantidad requerida.
- **Componente del catálogo**: Componente académico reconocido por el módulo local de generación; no representa inventario disponible ni compra real.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un estudiante autenticado puede registrar una idea válida y recibir su resultado en menos de 5 segundos en el entorno local.
- **SC-002**: El 100% de las ideas registradas conserva el estudiante propietario y la fecha de creación.
- **SC-003**: El 100% de las descripciones de prueba con términos reconocidos genera las entradas esperadas de BOM.
- **SC-004**: El 100% de los intentos de acceder a una idea ajena se rechazan sin revelar su contenido.
- **SC-005**: Una descripción sin términos reconocidos se registra sin componentes falsos y comunica claramente ese resultado.

## Assumptions

- SP1 proporciona la sesión del estudiante y su contexto de identidad autenticada.
- La BOM de SP2 es una sugerencia académica inicial, no una cotización, control de inventario ni recomendación de seguridad profesional.
- El catálogo inicial de términos es pequeño y local; incluirá los componentes que el equipo defina durante la planificación, sin usar IA ni servicios externos.
- La pantalla de consulta del resultado mostrará solo el proyecto recién creado y su BOM; una gestión completa de proyectos se tratará en un SP posterior.
- La persistencia existente conserva tablas para proyectos, componentes y BOM; cualquier ajuste se entregará con migración segura y sin afectar los datos de SP1.
