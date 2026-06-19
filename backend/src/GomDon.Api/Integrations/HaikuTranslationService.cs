using System.Text;
using System.Text.Json;
using GomDon.Modules.Orders.Services;

namespace GomDon.Api.Integrations;

/// <summary>
/// Dịch Trung → Việt bằng Claude Haiku 4.5 (rẻ & nhanh) qua Messages API.
/// Gộp toàn bộ cụm vào MỘT lần gọi, trả JSON map. Không có API key hoặc lỗi
/// → trả map rỗng (caller fallback giữ nguyên bản gốc).
/// </summary>
public sealed class HaikuTranslationService : ITranslationService
{
    private const string Model = "claude-haiku-4-5";
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<HaikuTranslationService> _log;

    public HaikuTranslationService(HttpClient http, IConfiguration config, ILogger<HaikuTranslationService> log)
    {
        _http = http; _config = config; _log = log;
    }

    public async Task<IReadOnlyDictionary<string, string>> TranslateAsync(IEnumerable<string> terms, CancellationToken ct = default)
    {
        var list = terms.Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().ToList();
        var empty = new Dictionary<string, string>();
        if (list.Count == 0) return empty;

        var apiKey = _config["Anthropic:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _log.LogWarning("Bỏ qua dịch: chưa cấu hình Anthropic:ApiKey (ANTHROPIC_API_KEY).");
            return empty;
        }

        var system = "Bạn dịch tên/đặc điểm/màu sản phẩm thương mại điện tử từ tiếng Trung sang tiếng Việt, gọn tự nhiên, " +
                     "KHÔNG để sót chữ Hán nào. Chỉ trả về JSON object map mỗi cụm đầu vào sang bản dịch tiếng Việt, không thêm gì khác.";
        var userPayload = JsonSerializer.Serialize(list);

        var body = new
        {
            model = Model,
            max_tokens = 1024,
            system,
            messages = new[] { new { role = "user", content = "Dịch các cụm sau, trả JSON object {gốc: dịch}: " + userPayload } },
        };

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
            req.Headers.Add("x-api-key", apiKey);
            req.Headers.Add("anthropic-version", "2023-06-01");
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            using var res = await _http.SendAsync(req, ct);
            var json = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
            {
                _log.LogWarning("Dịch thất bại {Status}: {Body}", (int)res.StatusCode, json);
                return empty;
            }

            using var doc = JsonDocument.Parse(json);
            var text = doc.RootElement.GetProperty("content")[0].GetProperty("text").GetString() ?? "";
            var jsonText = ExtractJsonObject(text);
            if (jsonText is null) return empty;

            using var map = JsonDocument.Parse(jsonText);
            var result = new Dictionary<string, string>();
            foreach (var p in map.RootElement.EnumerateObject())
            {
                var v = p.Value.ValueKind == JsonValueKind.String ? p.Value.GetString() : p.Value.ToString();
                if (!string.IsNullOrWhiteSpace(v)) result[p.Name] = v!;
            }
            _log.LogInformation("Đã dịch {N}/{Total} cụm sang tiếng Việt.", result.Count, list.Count);
            return result;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Lỗi khi gọi dịch Haiku.");
            return empty;
        }
    }

    // Claude đôi khi bọc JSON trong văn bản; lấy đoạn { ... } đầu tiên.
    private static string? ExtractJsonObject(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        return (start >= 0 && end > start) ? text.Substring(start, end - start + 1) : null;
    }
}
