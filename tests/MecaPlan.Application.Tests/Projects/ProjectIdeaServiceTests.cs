using MecaPlan.Application.Abstractions.Security;
using MecaPlan.Application.Projects;
using MecaPlan.Domain.Entities;
using Xunit;

namespace MecaPlan.Application.Tests.Projects;

public sealed class ProjectIdeaServiceTests
{
    [Fact]
    public async Task Creates_project_for_the_authenticated_student_and_saves_generated_bom()
    {
        var repository = new FakeRepository();
        var service = new ProjectIdeaService(new CurrentStudent(42), repository, new FixedGenerator());
        var result = await service.CreateAsync(new("Robot", "Arduino y motor"));
        Assert.True(result.Succeeded); Assert.Equal(42, repository.Project!.EstudianteID); Assert.Single(repository.Bom!);
    }

    [Fact]
    public async Task Rejects_an_empty_idea_without_saving()
    {
        var repository = new FakeRepository();
        var result = await new ProjectIdeaService(new CurrentStudent(1), repository, new FixedGenerator()).CreateAsync(new("", ""));
        Assert.False(result.Succeeded); Assert.Null(repository.Project);
    }

    private sealed class CurrentStudent(int id) : ICurrentStudentContext { public int StudentId => id; }
    private sealed class FixedGenerator : IBomGenerator { public IReadOnlyList<BomSuggestion> Generate(string description) => [new("Arduino Uno", 1)]; }
    private sealed class FakeRepository : IProyectoRepository
    {
        public Proyecto? Project { get; private set; } public IReadOnlyList<BomSuggestion>? Bom { get; private set; }
        public Task<int> CreateWithBomAsync(Proyecto project, IReadOnlyList<BomSuggestion> bom, CancellationToken ct = default) { Project = project; Bom = bom; return Task.FromResult(7); }
        public Task<Proyecto?> FindOwnedAsync(int projectId, int studentId, CancellationToken ct = default) => Task.FromResult<Proyecto?>(null);
    }
}
