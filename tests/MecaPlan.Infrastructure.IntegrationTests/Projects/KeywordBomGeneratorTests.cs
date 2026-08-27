using MecaPlan.Infrastructure.Projects;
using Xunit;

namespace MecaPlan.Infrastructure.IntegrationTests.Projects;

public sealed class KeywordBomGeneratorTests
{
    [Fact]
    public void Detects_known_components_case_insensitively_and_counts_mentions()
    {
        var bom = new KeywordBomGenerator().Generate("ARDUINO con arduino, servo y batería");
        Assert.Contains(bom, x => x.Componente == "Arduino Uno" && x.Cantidad == 2);
        Assert.Contains(bom, x => x.Componente == "Servomotor" && x.Cantidad == 1);
        Assert.Contains(bom, x => x.Componente == "Batería" && x.Cantidad == 1);
    }
}
