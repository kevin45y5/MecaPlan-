<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.1.0
- Modified principles: I. Desarrollo dirigido por especificación (aprobación explícita antes de implementar).
- Added: gate de autorización del propietario antes de ejecutar `/speckit.implement`.
- Removed: none.
- Deferred items: none. The selected AI provider and deployment environment are implementation
  decisions and MUST be specified per feature before integration.
-->

# Constitución de MecaPlan

## Propósito y alcance

MecaPlan es una plataforma web educativa que acompaña a estudiantes de mecatrónica desde
la idea de un prototipo hasta su ensamblaje y diagnóstico. Gestiona proyectos, inventario y
listas de materiales (BOM), y produce orientación técnica: pinout, firmware, explicaciones,
manual de ensamblaje, cotización y soporte ante fallas.

Esta constitución es vinculante para personas, agentes de IA y automatizaciones que cambien
este repositorio. Una conveniencia de implementación, una instrucción ad-hoc o una salida de
IA nunca prevalecen sobre ella.

## Principios fundamentales

### I. Desarrollo dirigido por especificación

- Cada capacidad nueva o cambio material MUST iniciar con una especificación en `specs/` que
  defina usuarios, alcance, fuera de alcance, flujos, reglas de negocio, criterios de aceptación
  verificables y riesgos.
- La implementación MUST seguir el orden: especificación, aclaraciones, plan, tareas, código,
  pruebas y revisión. No se permite escribir código de producto para requisitos ambiguos.
- Todo plan MUST incluir un `Constitution Check` explícito. Una violación de un MUST bloquea
  el cambio; se corrige la especificación o el diseño, no esta constitución por conveniencia.
- Los criterios de aceptación MUST ser demostrables sin depender de una respuesta no
  determinista de un modelo de IA.
- Antes de ejecutar `/speckit.implement` o cualquier comando que modifique código, migraciones,
  configuración o pruebas de una funcionalidad, el agente MUST solicitar y recibir autorización
  explícita del propietario del proyecto para esa implementación.

### II. Arquitectura mantenible y límites de responsabilidad

- La aplicación MUST mantenerse como una solución ASP.NET Core MVC sobre .NET 10, salvo una
  enmienda de esta constitución que apruebe otro marco.
- La presentación, aplicación, dominio e infraestructura MUST tener responsabilidades
  separadas. Los controladores y vistas MUST NOT contener SQL, reglas de negocio, secretos ni
  llamadas directas a proveedores de IA.
- El acceso a datos MUST estar encapsulado detrás de servicios o repositorios definidos y
  registrados mediante inyección de dependencias. Las dependencias MUST apuntar hacia el
  dominio, nunca desde el dominio hacia la interfaz o infraestructura.
- Cada módulo nuevo MUST declarar su propietario funcional y sus contratos de entrada y salida.
  No se permite duplicar reglas de cálculo entre la interfaz, servicios y base de datos.

### III. Integridad, seguridad y evolución de datos

- SQL Server es la fuente de persistencia. Los esquemas autorizados son `Seguridad`,
  `Inventario`, `Proyectos`, `Soporte` y `Eliminados`; cualquier adición MUST estar justificada
  en una especificación y con migración versionada.
- La identidad, claves foráneas, restricciones, índices y transacciones MUST proteger la
  integridad. Las operaciones que modifiquen stock o relacionen BOM y proyectos MUST ser
  atómicas y seguras frente a concurrencia.
- Las credenciales MUST guardarse únicamente como hashes fuertes con sal. Contraseñas,
  tokens, cadenas de conexión y claves de proveedores MUST NOT aparecer en código, repositorio,
  trazas, datos de prueba ni mensajes al usuario.
- Todo acceso a datos MUST usar consultas parametrizadas o un mecanismo equivalente. El
  principio de mínimo privilegio es obligatorio para usuarios, cuentas de base de datos y APIs.
- Las eliminaciones y cambios sensibles MUST conservar una auditoría trazable. Los scripts de
  ejemplo MUST respetar las columnas `NOT NULL` y no pueden invalidar las restricciones del
  esquema.

### IV. Verdad funcional del proyecto y de la BOM

- Un proyecto MUST pertenecer a un único estudiante autorizado. Un usuario sólo puede leer o
  modificar sus propios proyectos, BOM, entregables y diagnósticos, salvo un rol explícitamente
  especificado.
- Cada fila de BOM MUST referir un proyecto y un componente existentes, con cantidad entera
  positiva. El estado de faltante MUST derivarse de `CantidadRequerida` y del stock vigente; no
  se permite que el cliente lo declare arbitrariamente.
- La cotización MUST identificar moneda, fecha de cálculo, cantidades y precios usados. Los
  resultados históricos MUST conservar su contexto aunque el inventario cambie después.
- Reservar o descontar stock MUST ser una acción explícita, especificada y auditable; generar o
  consultar una BOM MUST NOT alterar el inventario por efecto secundario.

### V. Seguridad física, pedagogía y límites de la IA

- Las salidas de IA son borradores educativos y MUST mostrarse como orientación a revisar por
  el estudiante o docente. Nunca se presentarán como una garantía de seguridad o funcionamiento
  físico.
- Antes de publicar pinouts, firmware o instrucciones de ensamblaje, el sistema MUST ejecutar
  validaciones especificadas de compatibilidad eléctrica, alimentación, niveles lógicos, pines
  reservados y sintaxis. Si faltan datos críticos, MUST solicitarse la información o bloquear el
  entregable con una explicación clara.
- La generación MUST incluir una explicación pedagógica de las decisiones técnicas y advertir
  riesgos relevantes. No se permite recomendar conexiones potencialmente peligrosas sin una
  advertencia y revisión humana explícita.
- Los proveedores de IA MUST estar aislados detrás de una interfaz. Los prompts y respuestas
  MUST minimizar datos personales; ninguna clave ni dato sensible puede enviarse al proveedor
  salvo que la especificación, configuración y consentimiento lo autoricen expresamente.

### VI. Experiencia, accesibilidad y mensajes honestos

- Cada flujo MUST permitir al estudiante comprender qué datos proporciona, qué se genera, qué
  falta y cuál es el siguiente paso. Los errores MUST ser accionables y no revelar detalles
  internos, credenciales ni consultas.
- Las vistas MUST ser responsivas, navegables por teclado y usar etiquetas, contraste y mensajes
  de validación accesibles. Cada funcionalidad nueva MUST cubrir sus estados vacío, carga, éxito,
  error y sin autorización cuando correspondan.
- No se debe simular una acción realizada. Las respuestas de generación, guardado, descarga y
  diagnóstico MUST distinguir con precisión entre solicitado, procesando, completado y fallido.

### VII. Calidad verificable y entrega segura

- Ningún cambio se considera terminado sin compilar en limpio y ejecutar las pruebas aplicables
  con éxito. Toda regla nueva o corregida MUST contar con pruebas automatizadas de unidad o
  integración, y todo flujo crítico MUST contar con una prueba de extremo a extremo o una
  evidencia manual reproducible.
- Las pruebas MUST cubrir, como mínimo, autorización, validación de datos, faltantes de BOM,
  concurrencia de inventario cuando aplique y respuestas de error del proveedor de IA.
- Las dependencias nuevas MUST estar justificadas en el plan, mantenerse actualizadas y no
  sustituir una capacidad sencilla del marco sin razón documentada.
- La revisión MUST rechazar código muerto, advertencias nuevas, secretos, cambios no
  relacionados y degradaciones de rendimiento o accesibilidad no justificadas.

### VIII. Trazabilidad, documentación y colaboración

- Cada especificación MUST enlazar los requisitos con tareas, cambios, pruebas y criterios de
  aceptación. Las decisiones arquitectónicas relevantes MUST documentarse como ADR o en el plan.
- Los cambios de base de datos MUST incluir instrucciones de despliegue, reversión segura cuando
  sea viable y datos de prueba coherentes.
- Los commits MUST ser atómicos, describir el propósito y no mezclar refactorizaciones no
  relacionadas con cambios funcionales. Ningún agente puede ejecutar acciones remotas, publicar
  datos o modificar infraestructura sin autorización explícita del usuario.
- La documentación debe mantenerse en español claro para el dominio educativo; los nombres de
  código pueden seguir convenciones de .NET en inglés, pero deben ser consistentes.

## Puertas obligatorias de entrega

Antes de fusionar o entregar una capacidad, la evidencia MUST confirmar:

1. Especificación, plan y tareas alineados con esta constitución.
2. Modelo de datos, autorización y manejo de secretos revisados.
3. Criterios de aceptación y pruebas ejecutadas con resultado satisfactorio.
4. Salvaguardas físicas y límites de IA documentados para cualquier entregable técnico.
5. Documentación de usuario, migraciones y decisiones actualizadas cuando correspondan.

## Gobernanza

Esta constitución prevalece sobre convenciones informales y se revisa en toda especificación,
plan, tarea, implementación y revisión. Las excepciones sólo son válidas si una especificación
documenta el principio afectado, la justificación, el riesgo, la mitigación, el responsable y una
fecha de eliminación; una excepción no reduce una obligación futura.

Las enmiendas requieren una propuesta versionada, el motivo, el impacto sobre especificaciones,
plantillas y código, y aprobación explícita del propietario del proyecto. El versionado es
semántico: MAJOR para eliminar o redefinir principios de forma incompatible, MINOR para añadir
principios u obligaciones materiales y PATCH para aclaraciones no semánticas. Toda enmienda MUST
actualizar el informe de sincronización al inicio de este archivo.

## Contexto de fuentes

Los modelos BPMN, los scripts de base de datos y la documentación funcional aportada por el
equipo son fuentes de requisitos. En caso de conflicto, la especificación aprobada más reciente
debe registrar la decisión; esta constitución conserva prioridad para seguridad, integridad,
calidad y gobernanza.

**Versión**: 1.1.0 | **Ratificada**: 2026-08-24 | **Última enmienda**: 2026-08-24
