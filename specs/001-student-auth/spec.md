# Feature Specification: SP1 - Registro e inicio de sesión de estudiantes

**Feature Branch**: `001-student-auth` (identificador de especificación; no se creó una rama)

**Created**: 2026-08-24

**Status**: Draft

**Input**: Registro e inicio de sesión seguro para estudiantes de MecaPlan, con acceso personalizado a sus recursos académicos.

## Propósito

Permitir que cada estudiante cree una cuenta y acceda de forma segura a MecaPlan para que sus prototipos, inventarios, listas de materiales (BOM) y consultas de fallas permanezcan asociados exclusivamente a su identidad.

## Clarifications

### Session 2026-08-24

- Q: ¿Cómo debe iniciar la base de datos de desarrollo para SP1? → A: Adaptar la base `MecaPlanDB` existente y conservar sus datos actuales.
- Q: ¿Qué política mínima debe exigir la contraseña de un estudiante? → A: Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.
- Q: ¿Cuál debe ser el límite inicial para intentos fallidos de inicio de sesión? → A: Después de 5 intentos fallidos en 15 minutos, bloquear nuevos intentos durante 15 minutos.
- Q: ¿Qué nombre debe conservar la clave principal de estudiantes al adaptar la base existente? → A: Conservar `EstudianteID` en la tabla `Seguridad.Estudiantes`.
- Q: ¿Qué recursos personales debe proteger SP1 de forma demostrable? → A: Solo el dashboard y el contexto de identidad reutilizable; perfil, proyectos, BOM, inventario y diagnósticos se validarán en sus propios SPs.
- Q: ¿Qué datos son obligatorios al registrar un estudiante? → A: Nombre, apellido, carnet, correo electrónico, contraseña y confirmación de contraseña.

## Alcance inicial

Esta especificación cubre los siguientes alcances funcionales iniciales:

- **SP-11**: Formularios accesibles de registro e inicio de sesión.
- **SP-12**: Registro persistente de estudiantes y sus identificadores únicos.
- **SP-13**: Registro seguro de credenciales y creación de cuenta.
- **SP-14**: Validación del inicio de sesión y redirección al dashboard principal.

Las decisiones de implementación para la persistencia, la migración y la arquitectura se definirán y verificarán en el plan técnico, conforme a la constitución y a las restricciones de plataforma proporcionadas para esta funcionalidad.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar una cuenta de estudiante (Priority: P1)

Como estudiante sin cuenta, quiero registrarme con mi nombre, apellido, carnet, correo electrónico y contraseña para disponer de un espacio personalizado en MecaPlan.

**Why this priority**: Sin una identidad registrada no puede existir propiedad verificable sobre los recursos académicos del estudiante.

**Independent Test**: Puede probarse registrando un estudiante con datos válidos y comprobando que posteriormente puede autenticarse, sin depender de proyectos, BOM ni inventario.

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión y datos de registro válidos, **When** envía el formulario de registro, **Then** se crea una cuenta de estudiante y se confirma el resultado sin mostrar la contraseña.
2. **Given** un visitante, **When** intenta registrarse con un correo electrónico o carnet ya utilizado, **Then** la cuenta no se crea y recibe un mensaje seguro que le permite corregir el registro sin revelar credenciales ajenas.
3. **Given** un visitante, **When** envía datos obligatorios incompletos, con formato inválido o una contraseña que no cumple la política, **Then** la cuenta no se crea y se muestran errores accionables y accesibles.

---

### User Story 2 - Iniciar sesión y llegar al dashboard (Priority: P1)

Como estudiante registrado, quiero iniciar sesión con mis credenciales para llegar al dashboard principal y continuar con mis recursos personales.

**Why this priority**: Es el acceso necesario para que el registro aporte valor y para asociar todas las acciones futuras a un estudiante autenticado.

**Independent Test**: Puede probarse con una cuenta registrada: al introducir las credenciales correctas, el estudiante llega al dashboard principal; con credenciales incorrectas, no obtiene acceso.

**Acceptance Scenarios**:

1. **Given** un estudiante registrado sin sesión, **When** proporciona credenciales válidas, **Then** inicia sesión y es redirigido al dashboard principal.
2. **Given** un visitante o estudiante sin sesión, **When** proporciona credenciales inválidas, **Then** permanece sin autenticar y ve un único mensaje genérico que no indica cuál dato falló.
3. **Given** un estudiante autenticado, **When** finaliza su sesión, **Then** deja de poder acceder a recursos que requieren autenticación.

---

### User Story 3 - Proteger recursos personales (Priority: P1)

Como estudiante autenticado, quiero que la plataforma proteja mi dashboard y establezca una identidad reutilizable para que los futuros módulos limiten mis recursos a mi propia cuenta.

**Why this priority**: La separación de datos es un requisito de seguridad y la base de la confianza en la plataforma.

**Independent Test**: Puede probarse con dos cuentas distintas verificando que ninguna puede sustituir la identidad autenticada de la otra y que un visitante no accede al dashboard.

**Acceptance Scenarios**:

1. **Given** un estudiante autenticado, **When** consulta el dashboard, **Then** solo recibe contenido asociado a su propia identidad.
2. **Given** un estudiante autenticado, **When** intenta manipular un identificador de estudiante en una solicitud, **Then** el sistema conserva la identidad derivada de su sesión y no adopta el valor enviado por el cliente.
3. **Given** un visitante sin sesión, **When** intenta acceder directamente al dashboard, **Then** el sistema lo dirige al inicio de sesión sin mostrar contenido protegido.

### Edge Cases

- El correo electrónico contiene diferencias de mayúsculas/minúsculas, espacios iniciales/finales o formato inválido.
- El carnet ya existe, incluso si se intenta registrar con otro correo electrónico.
- Dos solicitudes de registro concurrentes usan el mismo correo o carnet; solo una cuenta puede quedar creada.
- Un estudiante reenvía un formulario de registro o inicia sesión varias veces seguidas.
- La sesión deja de ser válida mientras el estudiante navega hacia un recurso protegido.
- Se recibe una solicitud manipulada que intenta atribuir a un estudiante un identificador de otro estudiante.
- Se produce un fallo temporal al guardar o validar credenciales; no se crea una cuenta parcial ni se revelan detalles internos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir que un visitante se registre proporcionando nombre, apellido, carnet, correo electrónico, contraseña y confirmación de contraseña, tras validar que los datos obligatorios estén presentes y tengan formato válido.
- **FR-002**: El sistema MUST exigir contraseñas de al menos 8 caracteres, con una mayúscula, una minúscula, un número y un símbolo.
- **FR-003**: El sistema MUST conservar las credenciales de modo que ninguna contraseña pueda recuperarse, mostrarse o quedar almacenada en texto legible.
- **FR-004**: El sistema MUST impedir la creación de más de una cuenta con el mismo correo electrónico o el mismo carnet, incluso ante solicitudes simultáneas.
- **FR-005**: El sistema MUST permitir a un estudiante registrado iniciar sesión con su correo electrónico y contraseña válidos.
- **FR-006**: El sistema MUST redirigir al dashboard principal al estudiante que inicia sesión correctamente.
- **FR-007**: El sistema MUST mostrar el mismo mensaje genérico ante cualquier credencial inválida y no debe indicar si falló el correo electrónico, la contraseña o la existencia de una cuenta.
- **FR-008**: El sistema MUST impedir que una persona sin sesión válida acceda al dashboard protegido.
- **FR-009**: El sistema MUST establecer un contexto de identidad autenticada basado en `EstudianteID` que los futuros módulos de perfil, proyectos, BOM, inventario y diagnósticos usarán para limitar recursos a su propietario.
- **FR-010**: El sistema MUST permitir que un estudiante finalice su sesión y elimine el acceso a recursos protegidos desde ese contexto de uso.
- **FR-011**: El sistema MUST registrar de forma trazable los eventos relevantes de autenticación y los rechazos de acceso, sin incluir contraseñas, credenciales completas ni datos sensibles en dichos registros.
- **FR-012**: El sistema MUST presentar formularios y mensajes de validación que puedan utilizarse mediante teclado, etiquetas comprensibles y tecnologías de asistencia.
- **FR-013**: El sistema MUST presentar estados claros de envío, éxito, error y acceso denegado, sin simular que una acción de registro o inicio de sesión se completó cuando falló.
- **FR-014**: El sistema MUST bloquear nuevos intentos de inicio de sesión durante 15 minutos después de 5 intentos fallidos dentro de una ventana de 15 minutos, sin revelar detalles de la protección aplicada.

### Non-Functional Requirements

- **NFR-001 Seguridad**: Los mensajes, registros y pantallas no deben revelar secretos, contraseñas, datos de sesión ni detalles internos de validación.
- **NFR-002 Privacidad**: Los datos de identidad del estudiante se utilizarán exclusivamente para autenticarlo y asociar sus recursos, de acuerdo con el alcance de MecaPlan.
- **NFR-003 Integridad**: El alta de una cuenta debe ser atómica: ante un fallo, no debe quedar un estudiante incompleto ni una credencial inconsistente.
- **NFR-004 Usabilidad**: Una persona con los datos requeridos debe poder completar el registro y el inicio de sesión desde una interfaz responsiva y accesible.
- **NFR-005 Trazabilidad**: La implementación posterior deberá enlazar cada requisito de esta especificación con tareas, pruebas y evidencia de cumplimiento.

### Key Entities *(include if feature involves data)*

- **Estudiante**: Persona autenticable identificada por la clave persistente `EstudianteID`, única por carnet y correo electrónico, y propietaria de sus recursos personales en MecaPlan.
- **Credencial de acceso**: Información de autenticación asociada a un estudiante que permite verificar su identidad sin conservar la contraseña legible.
- **Sesión autenticada**: Contexto temporal que representa a un estudiante validado y determina los recursos personales a los que puede acceder.
- **Evento de autenticación**: Registro trazable de un resultado relevante de registro, inicio, cierre o rechazo de acceso, sin secretos.

## Security and Privacy Considerations

- El sistema no debe aceptar identificadores de propietario enviados por el cliente como prueba de autorización; la propiedad debe derivarse de la identidad autenticada.
- Las respuestas de error deben ser útiles para corregir datos de registro, pero no facilitar la enumeración de cuentas ni la adivinación de credenciales.
- Las protecciones contra intentos automatizados, el manejo de sesión, los tiempos de expiración y la auditoría concreta serán decisiones de plan sujetas al Constitution Check.
- Cualquier cambio posterior que incorpore recuperación de contraseña, verificación de correo, roles administrativos o autenticación externa requiere su propia especificación o una ampliación explícita de esta.

## Out of Scope

- Recuperación, cambio o restablecimiento de contraseña.
- Verificación del correo electrónico, autenticación multifactor, inicio de sesión social o autenticación institucional externa.
- Roles distintos de estudiante, administración de usuarios y autorización de docentes.
- Perfil de estudiante y creación, edición o migración funcional de proyectos, BOM, inventario o diagnósticos; esta especificación solo establece un contexto de identidad reutilizable para su aislamiento posterior.
- Integración con proveedores de IA, generación de firmware, pinouts o recomendaciones técnicas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una prueba de aceptación con datos válidos, el 100% de los registros crea una única cuenta asociada al carnet y correo proporcionados, sin exponer la contraseña.
- **SC-002**: En una prueba con correo o carnet duplicado, el 100% de los intentos duplicados es rechazado y no crea una segunda cuenta.
- **SC-003**: En una prueba con credenciales correctas, el 100% de los estudiantes autenticados llega al dashboard principal en una única interacción de inicio de sesión.
- **SC-004**: En una prueba con credenciales incorrectas, el 100% de las respuestas usa el mismo mensaje genérico y no concede acceso al dashboard ni a recursos protegidos.
- **SC-005**: En pruebas con dos estudiantes, el 100% de los intentos de sustituir la identidad autenticada mediante datos enviados por el cliente es rechazado o ignorado; ningún visitante accede al dashboard protegido.
- **SC-006**: En una prueba de uso manual, un estudiante puede completar el registro y el inicio de sesión en menos de tres minutos usando únicamente teclado.

## Assumptions

- Los únicos usuarios cubiertos por SP1 son estudiantes; los demás roles se definirán en especificaciones posteriores.
- El correo electrónico y el carnet identifican de manera única a una cuenta de estudiante y se validan sin distinguir mayúsculas/minúsculas en el correo.
- SP1 adapta la base SQL Server `MecaPlanDB` existente mediante migraciones versionadas y preflight; no crea una base alternativa ni elimina o reemplaza datos existentes automáticamente.
- La clave primaria existente conserva el nombre `EstudianteID`; las migraciones y los módulos futuros deben usar ese nombre de forma consistente.
- El dashboard principal existe o será preparado como destino protegido mínimo durante la implementación de SP1.
- La plataforma aplicará un contexto de autenticación estándar y protegido; su selección concreta y sus parámetros se decidirán durante el plan técnico.
- La retención de eventos de auditoría se concretará en el plan sin reducir los requisitos de seguridad de esta especificación.

## Dependencies and Traceability

- **Constitución**: Esta funcionalidad está sujeta de forma directa a los principios I (SDD), II (límites de responsabilidad), III (integridad y secretos), VI (accesibilidad y mensajes honestos), VII (pruebas) y VIII (trazabilidad).
- **SP-11 a SP-14**: Las subtareas proporcionadas por el solicitante conforman el alcance inicial y deberán convertirse en tareas técnicas dependientes durante `$speckit-tasks`.
- **Persistencia**: La planificación debe respetar la entidad y ubicación de persistencia autorizadas por el proyecto, incluida la restricción de almacenamiento proporcionada para estudiantes, mediante una migración versionada y auditable.
- **Autorización futura**: Las especificaciones de proyectos, BOM, inventario y diagnósticos deben reutilizar la identidad y las reglas de propiedad definidas por SP1.
