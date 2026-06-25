using System.Text;
using System.Text.Json;
using GomDon.Modules.Orders.Services;

namespace GomDon.Api.Integrations;

/// <summary>
/// Dịch Trung → Việt bằng Google Gemini 2.5 Flash (Generative Language API).
/// Gộp toàn bộ cụm vào MỘT lần gọi, ép trả JSON. Không có API key hoặc lỗi/quota
/// → trả map rỗng (caller fallback giữ nguyên bản gốc / từ điển tĩnh).
/// </summary>
public sealed class GeminiTranslationService : ITranslationService
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<GeminiTranslationService> _log;

    public GeminiTranslationService(HttpClient http, IConfiguration config, ILogger<GeminiTranslationService> log)
    {
        _http = http; _config = config; _log = log;
    }

    public async Task<IReadOnlyDictionary<string, string>> TranslateAsync(IEnumerable<string> terms, CancellationToken ct = default)
    {
        var list = terms.Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().ToList();
        var empty = new Dictionary<string, string>();
        if (list.Count == 0) return empty;

        var apiKey = _config["Gemini:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _log.LogWarning("Bỏ qua dịch: chưa cấu hình Gemini:ApiKey (GEMINI_API_KEY).");
            return empty;
        }
        var model = _config["Gemini:Model"] ?? "gemini-2.5-flash";

        // Trả về MẢNG theo thứ tự (không bắt model lặp lại key tiếng Trung — vốn hay bị
        // chuẩn hoá/đổi nên không khớp lại được). Service tự ghép input[i] -> output[i].
        var prompt = "Dịch tên/đặc điểm/màu/kích cỡ sản phẩm thương mại điện tử từ tiếng Trung sang tiếng Việt, " +
                     "tự nhiên, gọn; KHÔNG để sót chữ Hán nào trong bản dịch. " +
                     "Trả về DUY NHẤT một JSON array các bản dịch tiếng Việt theo ĐÚNG THỨ TỰ và ĐÚNG SỐ LƯỢNG cụm đầu vào, " +
                     "không thêm gì khác. Danh sách cần dịch (theo thứ tự): " + JsonSerializer.Serialize(list);

        var body = new
        {
            contents = new[] { new { parts = new[] { new { text = prompt } } } },
            generationConfig = new
            {
                temperature = 0,
                maxOutputTokens = 4096,
                responseMimeType = "application/json",
                thinkingConfig = new { thinkingBudget = 0 },
            },
        };

        try
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";
            using var req = new HttpRequestMessage(HttpMethod.Post, url);
            req.Headers.Add("x-goog-api-key", apiKey);
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            using var res = await _http.SendAsync(req, ct);
            var json = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
            {
                _log.LogWarning("Dịch Gemini thất bại {Status}: {Body}", (int)res.StatusCode, json);
                return empty;
            }

            using var doc = JsonDocument.Parse(json);
            var text = doc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content").GetProperty("parts")[0]
                .GetProperty("text").GetString() ?? "";

            var jsonText = ExtractJsonArray(text);
            if (jsonText is null) return empty;

            using var arr = JsonDocument.Parse(jsonText);
            if (arr.RootElement.ValueKind != JsonValueKind.Array) return empty;
            var translations = arr.RootElement.EnumerateArray()
                .Select(e => e.ValueKind == JsonValueKind.String ? e.GetString() : e.ToString())
                .ToList();

            // Ghép theo CHỈ SỐ: key = đúng nguyên văn input → OrderService luôn match được.
            var result = new Dictionary<string, string>();
            for (var i = 0; i < list.Count && i < translations.Count; i++)
            {
                var v = translations[i];
                if (!string.IsNullOrWhiteSpace(v)) result[list[i]] = v!;
            }
            _log.LogInformation("Gemini đã dịch {N}/{Total} cụm sang tiếng Việt.", result.Count, list.Count);
            return result;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Lỗi khi gọi dịch Gemini.");
            return empty;
        }
    }

    private static string? ExtractJsonArray(string text)
    {
        var start = text.IndexOf('[');
        var end = text.LastIndexOf(']');
        return (start >= 0 && end > start) ? text.Substring(start, end - start + 1) : null;
    }
}
