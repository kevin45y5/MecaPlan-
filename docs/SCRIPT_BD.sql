/* ============================================================================
   MecaPlan — Script de creación de la base de datos (SQL Server / Docker)
   ============================================================================
   Base de datos: MecaPlanDB
   Motor: SQL Server en contenedor Docker con autenticación SQL (usuario `sa`).

   Este script crea el esquema completo de la versión estable de MecaPlan:
   - 6 tablas (Estudiantes, Proyectos, Componentes, ProyectoComponentes,
     PasosEnsamblaje, Diagnosticos)
   - Claves primarias, relaciones (FK), índice único de Email
   - CHECK de Estado y NivelComplejidad
   - Drive por defecto: ver nota al final -> CÓMO APLICARLO.

   Se debe ejecutar conectado a SQL Server (p. ej. con sqlcmd dentro del
   contenedor) o desde SSMS apuntando al puerto 1433.
   ============================================================================ */

IF DB_ID(N'MecaPlanDB') IS NULL
BEGIN
    CREATE DATABASE MecaPlanDB;
END
GO

USE MecaPlanDB;
GO

/* ============================================================================
   TABLA: Estudiantes
   ============================================================================ */
IF OBJECT_ID(N'dbo.Estudiantes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Estudiantes (
        EstudianteID     int           IDENTITY(1,1) NOT NULL,
        Nombre           nvarchar(100) NOT NULL,
        Apellido         nvarchar(100) NOT NULL,
        Email            nvarchar(150) NOT NULL,
        PasswordHash     varchar(255)  NOT NULL,
        PasswordSalt     varchar(255)  NULL,
        Activo           bit           NOT NULL CONSTRAINT DF_Estudiantes_Activo DEFAULT (1),
        FechaRegistro    datetime      NOT NULL CONSTRAINT DF_Estudiantes_FechaRegistro DEFAULT (GETDATE()),
        FechaEliminacion datetime      NULL,
        CONSTRAINT PK_Estudiantes PRIMARY KEY (EstudianteID),
        CONSTRAINT UQ_Estudiantes_Email UNIQUE (Email)
    );
END
GO

/* ============================================================================
   TABLA: Proyectos
   ============================================================================ */
IF OBJECT_ID(N'dbo.Proyectos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Proyectos (
        ProyectoID            int           IDENTITY(1,1) NOT NULL,
        EstudianteID          int           NOT NULL,
        NombreProyecto        nvarchar(150) NOT NULL,
        DescripcionIdea       nvarchar(max) NOT NULL,
        NivelComplejidad      nvarchar(50)  NULL,
        Estado                nvarchar(50)  NOT NULL CONSTRAINT DF_Proyectos_Estado DEFAULT (N'En Desarrollo'),
        MaterialesPrevios     nvarchar(max) NULL,
        MaterialesRequeridos  nvarchar(max) NULL,
        Microcontrolador      nvarchar(80)  NULL,
        InstruccionesGeneradas nvarchar(max) NULL,
        CodigoGenerado        nvarchar(max) NULL,
        ConexionesCanvas      nvarchar(max) NULL,
        PosicionesCanvas      nvarchar(max) NULL,
        Activo                bit           NOT NULL CONSTRAINT DF_Proyectos_Activo DEFAULT (1),
        FechaCreacion         datetime      NOT NULL CONSTRAINT DF_Proyectos_FechaCreacion DEFAULT (GETDATE()),
        FechaEliminacion      datetime      NULL,
        CONSTRAINT PK_Proyectos PRIMARY KEY (ProyectoID),
        CONSTRAINT FK_Proyectos_Estudiantes FOREIGN KEY (EstudianteID)
            REFERENCES dbo.Estudiantes (EstudianteID),
        CONSTRAINT CK_Proyectos_Estado CHECK (Estado IN (N'En Desarrollo', N'Pausado', N'Completado', N'Cancelado')),
        CONSTRAINT CK_Proyectos_NivelComplejidad CHECK (NivelComplejidad IN (N'Básico', N'Intermedio', N'Avanzado'))
    );
END
GO

/* ============================================================================
   TABLA: Componentes
   Se usa como catálogo. Los `UrlImagen` pueden apuntar a los SVG de la app.
   ============================================================================ */
IF OBJECT_ID(N'dbo.Componentes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Componentes (
        ComponenteID     int           IDENTITY(1,1) NOT NULL,
        Nombre           nvarchar(100) NOT NULL,
        Categoria        nvarchar(50)  NOT NULL,
        StockDisponible  int           NOT NULL CONSTRAINT DF_Componentes_Stock DEFAULT (0),
        PrecioEstimado   decimal(10,2) NOT NULL CONSTRAINT DF_Componentes_Precio DEFAULT (0),
        UrlImagen        nvarchar(255) NULL,
        Activo           bit           NOT NULL CONSTRAINT DF_Componentes_Activo DEFAULT (1),
        FechaCreacion    datetime      NOT NULL CONSTRAINT DF_Componentes_FechaCreacion DEFAULT (GETDATE()),
        FechaEliminacion datetime      NULL,
        CONSTRAINT PK_Componentes PRIMARY KEY (ComponenteID)
    );
END
GO

/* ============================================================================
   TABLA: ProyectoComponentes  (desglose del BOM por proyecto)
   ============================================================================ */
IF OBJECT_ID(N'dbo.ProyectoComponentes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProyectoComponentes (
        ProyectoComponenteID int            IDENTITY(1,1) NOT NULL,
        ProyectoID           int            NOT NULL,
        ComponenteID         int            NOT NULL,
        CantidadRequerida    int            NOT NULL,
        EnInventario         bit            NOT NULL CONSTRAINT DF_PC_EnInventario DEFAULT (0),
        Motivo               nvarchar(300)  NULL,
        CONSTRAINT PK_ProyectoComponentes PRIMARY KEY (ProyectoComponenteID),
        CONSTRAINT FK_ProyectoComp_Proyectos FOREIGN KEY (ProyectoID)
            REFERENCES dbo.Proyectos (ProyectoID),
        CONSTRAINT FK_ProyectoComp_Componentes FOREIGN KEY (ComponenteID)
            REFERENCES dbo.Componentes (ComponenteID)
    );
END
GO

/* ============================================================================
   TABLA: PasosEnsamblaje  (tutorial paso a paso generado por la IA)
   ============================================================================ */
IF OBJECT_ID(N'dbo.PasosEnsamblaje', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PasosEnsamblaje (
        PasoID          int            IDENTITY(1,1) NOT NULL,
        ProyectoID      int            NOT NULL,
        NumeroPaso      int            NOT NULL,
        Titulo          nvarchar(150)  NOT NULL,
        Descripcion     nvarchar(max)  NOT NULL,
        UrlEsquema      nvarchar(255)  NULL,
        Completado      bit            NOT NULL CONSTRAINT DF_Pasos_Completado DEFAULT (0),
        FechaCreacion   datetime       NOT NULL CONSTRAINT DF_Pasos_FechaCreacion DEFAULT (GETDATE()),
        CONSTRAINT PK_PasosEnsamblaje PRIMARY KEY (PasoID),
        CONSTRAINT FK_Pasos_Proyectos FOREIGN KEY (ProyectoID)
            REFERENCES dbo.Proyectos (ProyectoID)
    );
END
GO

/* ============================================================================
   TABLA: Diagnosticos  (reportes de fallas del panel de diagnóstico)
   ============================================================================ */
IF OBJECT_ID(N'dbo.Diagnosticos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Diagnosticos (
        DiagnosticoID    int            IDENTITY(1,1) NOT NULL,
        ProyectoID       int            NOT NULL,
        TipoError        nvarchar(100)  NOT NULL,
        DescripcionFalla nvarchar(max)  NOT NULL,
        SolucionSugerida nvarchar(max)  NULL,
        FechaReporte     datetime       NOT NULL CONSTRAINT DF_Diag_FechaReporte DEFAULT (GETDATE()),
        FechaResolucion  datetime       NULL,
        CONSTRAINT PK_Diagnosticos PRIMARY KEY (DiagnosticoID),
        CONSTRAINT FK_Diagnosticos_Proyectos FOREIGN KEY (ProyectoID)
            REFERENCES dbo.Proyectos (ProyectoID)
    );
END
GO

/* ============================================================================
   TABLA: SimulacionDisenos  (diseños guardados de la vista 2D)
   ============================================================================ */
IF OBJECT_ID(N'dbo.SimulacionDisenos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SimulacionDisenos (
        SimulacionDisenoID int           IDENTITY(1,1) NOT NULL,
        ProyectoID         int           NOT NULL,
        Nombre             nvarchar(150) NOT NULL,
        Autor              nvarchar(100) NULL,
        PinoutJson         nvarchar(max) NULL,
        Codigo             nvarchar(max) NULL,
        ThumbnailBase64    nvarchar(max) NULL,
        Activo             bit           NOT NULL CONSTRAINT DF_Sim_Activo DEFAULT (1),
        FechaCreacion      datetime      NOT NULL CONSTRAINT DF_Sim_FechaCreacion DEFAULT (GETDATE()),
        FechaActualizacion datetime      NULL,
        CONSTRAINT PK_SimulacionDisenos PRIMARY KEY (SimulacionDisenoID),
        CONSTRAINT FK_SimulacionDisenos_Proyectos FOREIGN KEY (ProyectoID)
            REFERENCES dbo.Proyectos (ProyectoID)
    );
END
GO

/* ============================================================================
   ÍNDICE auxiliar: acelerar búsquedas por estudiante en Proyectos
   ============================================================================ */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SimulacionDisenos_ProyectoID' AND object_id = OBJECT_ID(N'dbo.SimulacionDisenos'))
    CREATE INDEX IX_SimulacionDisenos_ProyectoID ON dbo.SimulacionDisenos (ProyectoID, Activo);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Proyectos_EstudianteID' AND object_id = OBJECT_ID(N'dbo.Proyectos'))
    CREATE INDEX IX_Proyectos_EstudianteID ON dbo.Proyectos (EstudianteID, Activo);
GO

/* ============================================================================
   SEED: Componentes base de ejemplo (opcional)
   La app registra automáticamente los componentes que la IA detecta.
   Estos son el catálogo inicial con que arranca el sistema.
   ============================================================================ */
IF NOT EXISTS (SELECT 1 FROM dbo.Componentes)
BEGIN
    INSERT INTO dbo.Componentes (Nombre, Categoria, StockDisponible, PrecioEstimado, UrlImagen)
    VALUES
        (N'ESP32',                                   N'Inventario', 1, 0, NULL),
        (N'protoboard',                              N'Inventario', 1, 0, NULL),
        (N'servo motor',                             N'Faltante',   0, 0, NULL),
        (N'Cables Jumper (Macho-Hembra / Macho-Macho)', N'Faltante', 0, 0, NULL),
        (N'Fuente de alimentación de 5V para protoboard', N'Faltante', 0, 0, NULL),
        (N'Arduino Uno',                             N'Inventario', 1, 0, NULL),
        (N'Placa Arduino Uno R3',                    N'Faltante',   0, 0, NULL),
        (N'Servomotor MG996R',                       N'Faltante',   0, 0, NULL),
        (N'Módulo RTC DS3231',                       N'Faltante',   0, 0, NULL),
        (N'Sensor Ultrasónico HC-SR04',              N'Faltante',   0, 0, NULL),
        (N'Buzzer Activo',                           N'Faltante',   0, 0, NULL);
END
GO

/* ============================================================================
   SEED: cuenta de ejemplo (OPCIONAL)
   constará PasswordHash/PasswordSalt generados por PasswordHasher.cs
   (PBKDF2 SHA-256). Deja el campo Activo=1.
   ============================================================================ */
/* Ejemplo (requiere un hash real generado por la app):
INSERT INTO dbo.Estudiantes (Nombre, Apellido, Email, PasswordHash, PasswordSalt, Activo)
VALUES (N'Unice', N'Estudiante', N'correo@ejemplo.com', N'<hash>', N'<salt>', 1);
*/

/* ============================================================================
   NOTA — CÓMO APLICARLO
   ---------------------
   1) SQL Server está en Docker (contenedor `mecaplan-sql`, puerto 1433).
   2) Copia este archivo al contenedor y ejecútalo con sqlcmd:

        docker cp SCRIPT_BD.sql mecaplan-sql:/tmp/SCRIPT_BD.sql
        docker exec mecaplan-sql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa \
          -P "MecaPlan2026!Sql" -C -i /tmp/SCRIPT_BD.sql

   La app NO crea la base automáticamente (solo valida conexión en Development),
   por lo que esta base se debe crear con este script (o restaurarse).
   ============================================================================ */
GO
