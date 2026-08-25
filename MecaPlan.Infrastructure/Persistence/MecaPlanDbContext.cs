using Microsoft.EntityFrameworkCore; using MecaPlan.Domain.Entities;
namespace MecaPlan.Infrastructure.Persistence;
public sealed class MecaPlanDbContext(DbContextOptions<MecaPlanDbContext> options):DbContext(options)
{ public DbSet<Estudiante> Estudiantes=>Set<Estudiante>(); public DbSet<EventoAutenticacion> EventosAutenticacion=>Set<EventoAutenticacion>(); protected override void OnModelCreating(ModelBuilder b){ b.ApplyConfigurationsFromAssembly(typeof(MecaPlanDbContext).Assembly); } }
