# MecaPlan — Versión Estable V5

Plataforma educativa de diseño, simulación y ensamblaje de proyectos electrónicos (Arduino).
El estudiante registra su proyecto, valida la lista de materiales (BOM), simula el circuito en
un editor 2D, genera el código fuente y sigue una guía de ensamblaje paso a paso.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | ASP.NET Core (.NET 10, MVC + API) |
| Base de datos | SQL Server (Entity Framework Core) |
| IA | Anthropic Claude (`claude-sonnet-4-5`) — generación, diagnóstico y gestión de conexiones |
| Simulador 2D | Konva.js + compilador Arduino AVR (avr-gcc-wasm) en el navegador |
| Diagrama / Workspace | ReactFlow (`@xyflow/react`) + React 18 + Vite |
| Frontend adicional | Bootstrap, jQuery (wwwroot/lib) |

## Diagrama de base de datos (ERD)

Modelo relacional de `MecaPlanDB`. Las relaciones clave:

- **Estudiante** 1 — N **Proyectos**
- **Proyecto** 1 — N **ProyectoComponentes** (N — 1 **Componente**)
- **Proyecto** 1 — N **PasosEnsamblaje**
- **Proyecto** 1 — N **Diagnosticos**
- **Proyecto** 1 — N **SimulacionDisenos**

![Diagrama Entidad-Relación (DER)](https://www.plantuml.com/plantuml/proxy?src=https://raw.githubusercontent.com/kevin45y5/MecaPlan-/main/docs/diagrams/erd-base-datos.puml&v=3)

```plantuml
@startuml
!theme plain
skinparam linetype ortho
hide circle
title MecaPlan — Modelo de datos (SQL Server)

entity "Estudiante" as EST {
  * EstudianteID : int <<PK>>
  --
  Nombre : nvarchar(100)
  Apellido : nvarchar(100)
  Email : nvarchar(150) <<UK>>
  PasswordHash : varbinary
  PasswordSalt : varbinary
  Activo : bit
  FechaRegistro : datetime
  FechaEliminacion : datetime?
}

entity "Proyecto" as PRO {
  * ProyectoID : int <<PK>>
  --
  EstudianteID : int <<FK>>
  NombreProyecto : nvarchar(150)
  DescripcionIdea : nvarchar(max)
  NivelComplejidad : nvarchar(50)
  MaterialesPrevios : nvarchar(max)?
  MaterialesRequeridos : nvarchar(max)?
  Microcontrolador : nvarchar(80)?
  InstruccionesGeneradas : nvarchar(max)?
  CodigoGenerado : nvarchar(max)?
  ConexionesCanvas : nvarchar(max)?
  PosicionesCanvas : nvarchar(max)?
  Estado : nvarchar(50)
  Activo : bit
  FechaCreacion : datetime
  FechaEliminacion : datetime?
}

entity "Componente" as COM {
  * ComponenteID : int <<PK>>
  --
  Nombre : nvarchar(100)
  Categoria : nvarchar(50)
  StockDisponible : int
  PrecioEstimado : decimal(10,2)
  UrlImagen : nvarchar(255)?
  Activo : bit
  FechaCreacion : datetime
  FechaEliminacion : datetime?
}

entity "ProyectoComponente" as PCO {
  * ProyectoComponenteID : int <<PK>>
  --
  ProyectoID : int <<FK>>
  ComponenteID : int <<FK>>
  CantidadRequerida : int
  EnInventario : bit
  Motivo : nvarchar(300)?
}

entity "PasoEnsamblaje" as PAS {
  * PasoID : int <<PK>>
  --
  ProyectoID : int <<FK>>
  NumeroPaso : int
  Titulo : nvarchar(150)
  Descripcion : nvarchar(max)
  UrlEsquema : nvarchar(255)?
  Completado : bit
  FechaCreacion : datetime
}

entity "Diagnostico" as DIA {
  * DiagnosticoID : int <<PK>>
  --
  ProyectoID : int <<FK>>
  TipoError : nvarchar(100)
  DescripcionFalla : nvarchar(max)
  SolucionSugerida : nvarchar(max)?
  FechaReporte : datetime
  FechaResolucion : datetime?
}

entity "SimulacionDiseno" as SIM {
  * SimulacionDisenoID : int <<PK>>
  --
  ProyectoID : int <<FK>>
  Nombre : nvarchar(150)
  Autor : nvarchar(100)?
  PinoutJson : nvarchar(max)?
  Codigo : nvarchar(max)?
  ThumbnailBase64 : nvarchar(max)?
  Activo : bit
  FechaCreacion : datetime
  FechaActualizacion : datetime?
}

EST ||--o{ PRO : "posee"
PRO ||--o{ PCO : "requiere"
COM ||--o{ PCO : "se usa en"
PRO ||--o{ PAS : "tiene pasos"
PRO ||--o{ DIA : "se diagnostica"
PRO ||--o{ SIM : "se simula"
@enduml
```

Consulta el script SQL completo en `docs/SCRIPT_BD.sql`.

Los archivos fuente PlantUML de todos los diagramas viven en `docs/diagrams/*.puml`
(si quieres regenerar las imágenes, ábrelos en [PlantUML](https://plantuml.com/) o VS Code
con la extensión PlantUML).

## Diagramas BPM (procesos de negocio)

### BPMN 1 — Registro y autenticación de estudiante

![BPMN 1 — Registro y autenticación de estudiante](https://www.plantuml.com/plantuml/proxy?src=https://raw.githubusercontent.com/kevin45y5/MecaPlan-/main/docs/diagrams/bpmn-01-autenticacion.puml&v=3)

```plantuml
@startuml
!theme plain
title BPMN — Registro y autenticación (Account)

start
:Estudiante accede a la app;
if (¿Tiene cuenta?) then (No)
  :Registra Nombre, Apellido, Email y contraseña;
  :Valida datos y email único;
  if (¿Datos válidos?) then (No)
    :Muestra errores;
    stop
  else (Sí)
    :Aplica hash + salt a la contraseña;
    :Guarda Estudiante en BD;
  endif
else (Sí)
endif
:Inicia sesión (cookie MecaPlan.Auth, 8 h);
:Redirige a Home / url solicitada;
stop
@enduml
```

### BPMN 2 — Creación de proyecto y validación de BOM

![BPMN 2 — Creación de proyecto y validación de BOM](https://www.plantuml.com/plantuml/proxy?src=https://raw.githubusercontent.com/kevin45y5/MecaPlan-/main/docs/diagrams/bpmn-02-creacion-bom.puml&v=3)

```plantuml
@startuml
!theme plain
title BPMN — Creación de proyecto y BOM (Proyectos)

start
:Estudiante autenticado crea proyecto;
:Describe idea, complejidad y microcontrolador;
:IA genera lista de materiales y faltantes (Claude);
:Confirma BOM de componentes;
if (¿Hay faltantes?) then (Sí)
  :Muestra material previo / lo solicita;
endif
:Proyecto queda en "En Desarrollo";
stop
@enduml
```

### BPMN 3 — Flujo del simulador 2D y sincronización con el diagrama

![BPMN 3 — Flujo del simulador 2D y sincronización con el diagrama](https://www.plantuml.com/plantuml/proxy?src=https://raw.githubusercontent.com/kevin45y5/MecaPlan-/main/docs/diagrams/bpmn-03-simulador-diagrama.puml&v=3)

```plantuml
@startuml
!theme plain
title BPMN — Simulador 2D → Diagrama (Workspace)

start
:Abre Simulador de un proyecto;
:Agrega componentes en el lienzo 2D (Konva);
:Conecta terminales con cables;
:Etiquetas automáticas por cable (pin → pin);
:Crea wire con pan del lienzo;
if (¿Guardar diseño?) then (Sí)
  :Serializa PINOUT (nodes + connections);
  :ApiSaveDesign guarda SimulacionDiseno (.PinoutJson);
  :Sincroniza Proyecto.ConexionesCanvas (origen/destino/color_cable);
else
endif
if (¿Acomodar con IA?) then (Sí)
  :ApiAiManageConnections (Claude);
  :Valida/ordena conexiones y rebuildConnections;
else
endif
:Accede al Workspace/diagrama (ReactFlow);
:Guarda código generado y canvas;
:Reporta diagnóstico si hay falla;
stop
@enduml
```

### BPMN 4 — Guía de ensamblaje y diagnóstico

![BPMN 4 — Guía de ensamblaje y diagnóstico](https://www.plantuml.com/plantuml/proxy?src=https://raw.githubusercontent.com/kevin45y5/MecaPlan-/main/docs/diagrams/bpmn-04-guia-diagnostico.puml&v=3)

```plantuml
@startuml
!theme plain
title BPMN — Guía de ensamblaje y diagnóstico (Guia / Diagnosticos)

start
:Estudiante abre la guía del proyecto;
:Marca pasos de ensamblaje como completados (NumeroPaso);
if (¿Falla el circuito?) then (Sí)
  :Reporta Diagnostico (tipo, descripción);
  :IA sugiere solución (Claude);
  :Resuelve y registra FechaResolucion;
else (No)
endif
:Proyecto avanza / se retoma;
stop
@enduml
```

## Módulos principales

| Ruta | Módulo | Descripción |
|---|---|---|
| `/Account/*` | Autenticación | Registro, login, logout (cookie) |
| `/Proyectos` | Proyectos | Detalle, BOM, Workspace, Guía, Diagnóstico |
| `/Simulador` | Simulador 2D | Editor de circuito con IA (Claude) |
| `/Biblioteca` | Biblioteca | Manuales, datasheets, normativas, guías |
| `/Esquemas`, `/Galeria` | Esquemas / Galería | Visualización de diseños |
| `/Diagnosticos` | Diagnósticos | Historial y resolución de fallas |

## Requisitos para ejecutar

- .NET 10 SDK + SQL Server (o contenedor `mecaplan-sql` en el puerto 1433).
- Clave de Anthropic en `appsettings.Development.json` (no versionada) o UserSecrets.
- Clave de Google Gemini en `Simulador/.env` (no versionada) si usas la API Node.