/*
  MecaPlanDB - instalación inicial local
  Ejecutar en SQL Server / SQL Server Express desde SQL Server Management Studio.
  Este script no elimina bases ni tablas existentes.
*/
USE master;
GO

IF DB_ID(N'MecaPlanDB') IS NULL
BEGIN
    CREATE DATABASE MecaPlanDB;
END
GO

USE MecaPlanDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'Seguridad') EXEC(N'CREATE SCHEMA Seguridad');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'Inventario') EXEC(N'CREATE SCHEMA Inventario');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'Proyectos') EXEC(N'CREATE SCHEMA Proyectos');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'Soporte') EXEC(N'CREATE SCHEMA Soporte');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'Eliminados') EXEC(N'CREATE SCHEMA Eliminados');
GO

IF OBJECT_ID(N'Seguridad.Estudiantes', N'U') IS NULL
BEGIN
    CREATE TABLE Seguridad.Estudiantes
    (
        EstudianteID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Estudiantes PRIMARY KEY,
        Nombre NVARCHAR(100) NOT NULL,
        Apellido NVARCHAR(100) NOT NULL,
        Carnet NVARCHAR(50) NOT NULL,
        Email NVARCHAR(256) NOT NULL,
        EmailNormalizado NVARCHAR(256) NOT NULL,
        PasswordHash NVARCHAR(512) NOT NULL,
        FechaRegistro DATETIME2 NOT NULL CONSTRAINT DF_Estudiantes_FechaRegistro DEFAULT SYSUTCDATETIME(),
        EstadoBit BIT NOT NULL CONSTRAINT DF_Estudiantes_EstadoBit DEFAULT 1,
        CONSTRAINT UX_Estudiantes_Carnet UNIQUE (Carnet),
        CONSTRAINT UX_Estudiantes_EmailNormalizado UNIQUE (EmailNormalizado)
    );
END
GO

IF OBJECT_ID(N'Seguridad.EventosAutenticacion', N'U') IS NULL
BEGIN
    CREATE TABLE Seguridad.EventosAutenticacion
    (
        IdEventoAutenticacion INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EventosAutenticacion PRIMARY KEY,
        EstudianteID INT NULL,
        TipoEvento NVARCHAR(50) NOT NULL,
        Resultado NVARCHAR(20) NOT NULL,
        FechaUtc DATETIME2 NOT NULL CONSTRAINT DF_EventosAutenticacion_FechaUtc DEFAULT SYSUTCDATETIME(),
        CorrelationId NVARCHAR(100) NOT NULL,
        OrigenMinimizado NVARCHAR(100) NULL,
        CONSTRAINT FK_EventosAutenticacion_Estudiantes FOREIGN KEY (EstudianteID)
            REFERENCES Seguridad.Estudiantes(EstudianteID)
    );
    CREATE INDEX IX_EventosAutenticacion_Estudiante_FechaUtc
        ON Seguridad.EventosAutenticacion (EstudianteID, FechaUtc);
END
GO

IF OBJECT_ID(N'Inventario.Componentes', N'U') IS NULL
BEGIN
    CREATE TABLE Inventario.Componentes
    (
        ComponenteID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Componentes PRIMARY KEY,
        Nombre NVARCHAR(150) NOT NULL,
        Tipo NVARCHAR(100) NOT NULL,
        StockDisponible INT NOT NULL CONSTRAINT DF_Componentes_Stock DEFAULT 0,
        PrecioEstimado DECIMAL(10,2) NULL,
        Estado BIT NOT NULL CONSTRAINT DF_Componentes_Estado DEFAULT 1
    );
END
GO

IF OBJECT_ID(N'Proyectos.Proyectos', N'U') IS NULL
BEGIN
    CREATE TABLE Proyectos.Proyectos
    (
        ProyectoID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Proyectos PRIMARY KEY,
        EstudianteID INT NOT NULL,
        NombreProyecto NVARCHAR(150) NOT NULL,
        DescripcionIdea NVARCHAR(MAX) NOT NULL,
        Estado NVARCHAR(50) NOT NULL CONSTRAINT DF_Proyectos_Estado DEFAULT N'Activo',
        FechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_Proyectos_FechaCreacion DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Proyectos_Estudiantes FOREIGN KEY (EstudianteID)
            REFERENCES Seguridad.Estudiantes(EstudianteID)
    );
END
GO

IF OBJECT_ID(N'Proyectos.BOMProyectos', N'U') IS NULL
BEGIN
    CREATE TABLE Proyectos.BOMProyectos
    (
        BOMID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BOMProyectos PRIMARY KEY,
        ProyectoID INT NOT NULL,
        ComponenteID INT NOT NULL,
        CantidadRequerida INT NOT NULL,
        EsFaltante BIT NOT NULL CONSTRAINT DF_BOMProyectos_EsFaltante DEFAULT 0,
        CONSTRAINT FK_BOMProyectos_Proyectos FOREIGN KEY (ProyectoID)
            REFERENCES Proyectos.Proyectos(ProyectoID),
        CONSTRAINT FK_BOMProyectos_Componentes FOREIGN KEY (ComponenteID)
            REFERENCES Inventario.Componentes(ComponenteID),
        CONSTRAINT CK_BOMProyectos_Cantidad CHECK (CantidadRequerida > 0)
    );
END
GO

IF OBJECT_ID(N'Soporte.Diagnosticos', N'U') IS NULL
BEGIN
    CREATE TABLE Soporte.Diagnosticos
    (
        DiagnosticoID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Diagnosticos PRIMARY KEY,
        ProyectoID INT NOT NULL,
        TipoError NVARCHAR(100) NOT NULL,
        DescripcionFalla NVARCHAR(MAX) NOT NULL,
        SolucionSugerida NVARCHAR(MAX) NULL,
        FechaReporte DATETIME2 NOT NULL CONSTRAINT DF_Diagnosticos_FechaReporte DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Diagnosticos_Proyectos FOREIGN KEY (ProyectoID)
            REFERENCES Proyectos.Proyectos(ProyectoID)
    );
END
GO

SELECT s.name AS Esquema, t.name AS Tabla
FROM sys.tables AS t
INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id
WHERE s.name IN (N'Seguridad', N'Inventario', N'Proyectos', N'Soporte')
ORDER BY s.name, t.name;
GO
