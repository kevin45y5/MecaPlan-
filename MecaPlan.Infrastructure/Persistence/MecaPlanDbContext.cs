using Microsoft.EntityFrameworkCore; using MecaPlan.Domain.Entities;
namespace MecaPlan.Infrastructure.Persistence;
public sealed class MecaPlanDbContext(DbContextOptions<MecaPlanDbContext> options):DbContext(options)
{ public DbSet<Estudiante> Estudiantes=>Set<Estudiante>(); public DbSet<EventoAutenticacion> EventosAutenticacion=>Set<EventoAutenticacion>(); public DbSet<Proyecto> Proyectos=>Set<Proyecto>(); public DbSet<Componente> Componentes=>Set<Componente>(); public DbSet<BomProyecto> BomProyectos=>Set<BomProyecto>(); protected override void OnModelCreating(ModelBuilder b){ b.ApplyConfigurationsFromAssembly(typeof(MecaPlanDbContext).Assembly); } }
