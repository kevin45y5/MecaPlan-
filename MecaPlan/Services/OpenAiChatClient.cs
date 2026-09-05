using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace MecaPlan.Services
{
    public class OpenAiChatClient : IAiChatClient
    {
        private readonly HttpClient _http;
        private readonly AiOptions _options;

        public OpenAiChatClient(HttpClient http, IOptions<AiOptions> options)
        {
            _http = http;
            _options = options.Value;
        }

        public Task<string> CompleteJsonAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default)
        {
            return LlamarOpenAiAsync(systemPrompt, userPrompt, json: true, cancellationToken);
        }

        public Task<string> CompleteTextAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default)
        {
            return LlamarOpenAiAsync(systemPrompt, userPrompt, json: false, cancellationToken);
        }

        private async Task<string> LlamarOpenAiAsync(string systemPrompt, string userPrompt, bool json, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(_options.ApiKey))
            {
                throw new InvalidOperationException(
                    "Falta la clave de IA. Configura Ai:ApiKey en appsettings o la variable Ai__ApiKey.");
            }

            var endpoint = string.IsNullOrWhiteSpace(_options.Endpoint)
                ? "https://api.openai.com/v1/chat/completions"
                : _options.Endpoint;

            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey.Trim());

            var payload = new
            {
                model = string.IsNullOrWhiteSpace(_options.Model) ? "gpt-4o-mini" : _options.Model,
                temperature = 0.3,
                response_format = json ? new { type = "json_object" } : null,
                messages = new object[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                }
            };

            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            using var response = await _http.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException($"La IA no respondió ({(int)response.StatusCode}).");
            }

            using var doc = JsonDocument.Parse(body);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(content))
            {
                throw new InvalidOperationException("La IA devolvió una respuesta vacía.");
            }

            return json ? ExtractJson(content) : content;
        }

        internal static string ExtractJson(string text)
        {
            var trimmed = text.Trim();
            if (trimmed.StartsWith("```", StringComparison.Ordinal))
            {
                var firstBreak = trimmed.IndexOf('\n');
                if (firstBreak >= 0)
                {
                    trimmed = trimmed[(firstBreak + 1)..];
                }

                var fence = trimmed.LastIndexOf("```", StringComparison.Ordinal);
                if (fence >= 0)
                {
                    trimmed = trimmed[..fence];
                }

                trimmed = trimmed.Trim();
            }

            var start = trimmed.IndexOf('{');
            var end = trimmed.LastIndexOf('}');
            if (start < 0 || end <= start)
            {
                throw new InvalidOperationException("La IA no devolvió un JSON válido.");
            }

            return trimmed[start..(end + 1)];
        }
    }
}
