using System.Text.RegularExpressions;
using MecaPlan.Application.Projects;

namespace MecaPlan.Infrastructure.Projects;

public sealed class KeywordBomGenerator : IBomGenerator
{
    private static readonly IReadOnlyDictionary<string, string> Catalog = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["arduino"] = "Arduino Uno", ["sensor ultrasónico"] = "Sensor ultrasónico", ["ultrasonico"] = "Sensor ultrasónico",
        ["motor dc"] = "Motor DC", ["servomotor"] = "Servomotor", ["servo"] = "Servomotor",
        ["l298n"] = "Driver L298N", ["batería"] = "Batería", ["bateria"] = "Batería", ["led"] = "LED"
    };

    public IReadOnlyList<BomSuggestion> Generate(string descripcionIdea) => Catalog
        .GroupBy(pair => pair.Value)
        .Select(group => new BomSuggestion(group.Key, group.Sum(pair => Regex.Matches(descripcionIdea, $@"(?<!\w){Regex.Escape(pair.Key)}(?!\w)", RegexOptions.IgnoreCase).Count)))
        .Where(item => item.Cantidad > 0).ToList();
}
