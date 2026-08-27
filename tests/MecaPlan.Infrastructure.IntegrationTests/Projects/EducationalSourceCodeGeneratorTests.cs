using MecaPlan.Application.Projects;
using MecaPlan.Infrastructure.Projects;
using Xunit;

namespace MecaPlan.Infrastructure.IntegrationTests.Projects;

public sealed class EducationalSourceCodeGeneratorTests
{
    [Theory]
    [InlineData(TargetBoard.ArduinoUno, ".ino")]
    [InlineData(TargetBoard.Esp32, ".cpp")]
    [InlineData(TargetBoard.Pic, ".c")]
    public void Generates_utf8_ready_source_with_the_correct_extension(TargetBoard board, string extension)
    {
        var result = new EducationalSourceCodeGenerator().Generate(new("Brazo clasificacíon", "Motor y sensor", board));

        Assert.Equal(extension, result.Extension);
        Assert.EndsWith(extension, result.FileName);
        Assert.Contains("Proyecto", result.Code);
        Assert.Contains("coment", EducationalSourceCodeGenerator.SystemPrompt, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("\r", result.Code);
    }
}
