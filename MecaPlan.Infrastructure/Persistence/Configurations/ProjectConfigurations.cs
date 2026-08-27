using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MecaPlan.Domain.Entities;

namespace MecaPlan.Infrastructure.Persistence.Configurations;

public sealed class ProyectoConfiguration : IEntityTypeConfiguration<Proyecto>
{
    public void Configure(EntityTypeBuilder<Proyecto> b)
    {
        b.ToTable("Proyectos", "Proyectos"); b.HasKey(x => x.ProyectoID);
        b.Property(x => x.NombreProyecto).HasMaxLength(150).IsRequired(); b.Property(x => x.DescripcionIdea).HasMaxLength(4000).IsRequired();
        b.Property(x => x.FechaCreacion).HasDefaultValueSql("SYSUTCDATETIME()"); b.HasIndex(x => x.EstudianteID);
        b.HasMany(x => x.EntradasBom).WithOne().HasForeignKey(x => x.ProyectoID).OnDelete(DeleteBehavior.Cascade);
    }
}
public sealed class ComponenteConfiguration : IEntityTypeConfiguration<Componente>
{
    public void Configure(EntityTypeBuilder<Componente> b) { b.ToTable("Componentes", "Inventario"); b.HasKey(x => x.ComponenteID); b.Property(x => x.Nombre).HasMaxLength(150).IsRequired(); b.Property(x => x.Tipo).HasMaxLength(100).IsRequired(); b.HasIndex(x => x.Nombre).IsUnique(); }
}
public sealed class BomProyectoConfiguration : IEntityTypeConfiguration<BomProyecto>
{
    public void Configure(EntityTypeBuilder<BomProyecto> b) { b.ToTable("BOMProyectos", "Proyectos"); b.HasKey(x => x.BOMID); b.Property(x => x.CantidadRequerida).IsRequired(); b.HasOne(x => x.Componente).WithMany().HasForeignKey(x => x.ComponenteID); b.HasIndex(x => new { x.ProyectoID, x.ComponenteID }).IsUnique(); }
}
