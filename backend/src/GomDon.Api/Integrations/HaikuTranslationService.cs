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

        // Đánh số id cho từng cụm; model trả object {id: bản dịch}. Dùng id (không bắt model
        // lặp lại chuỗi Hán dài — vốn hay bị copy nguyên/không dịch hoặc lệch thứ tự).
        var indexed = new Dictionary<string, string>();
        for (var i = 0; i < list.Count; i++) indexed[i.ToString()] = list[i];

        var system = "Bạn là người dịch thương mại điện tử Trung→Việt. Mỗi value là tên/đặc điểm/màu/kích cỡ sản phẩm " +
                     "(có thể là TIÊU ĐỀ nhồi nhiều từ khoá). Hãy DỊCH MỖI value sang tiếng Việt tự nhiên, gọn, có nghĩa; " +
                     "TUYỆT ĐỐI KHÔNG giữ nguyên tiếng Trung, KHÔNG để sót chữ Hán. Chỉ trả về DUY NHẤT một JSON object có " +
                     "CÙNG các key (số thứ tự) như đầu vào, value là bản dịch tiếng Việt.";
        var userPayload = JsonSerializer.Serialize(indexed);

        var body = new
        {
            model = Model,
            max_tokens = 2048,
            system,
            messages = new[] { new { role = "user", content = "Dịch các value sau, trả JSON object {id: bản dịch}: " + userPayload } },
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
            if (map.RootElement.ValueKind != JsonValueKind.Object) return empty;

            // Ghép theo id → key = đúng nguyên văn input. Bỏ qua value còn sót chữ Hán (dịch hụt)
            // để OrderService rơi về plan B (giữ tên gốc) thay vì tưởng đã dịch.
            var result = new Dictionary<string, string>();
            foreach (var p in map.RootElement.EnumerateObject())
            {
                if (!int.TryParse(p.Name, out var idx) || idx < 0 || idx >= list.Count) continue;
                var v = p.Value.ValueKind == JsonValueKind.String ? p.Value.GetString() : p.Value.ToString();
                if (!string.IsNullOrWhiteSpace(v) && !HasCjk(v)) result[list[idx]] = v!;
            }
            if (result.Count < list.Count)
                _log.LogWarning("Haiku dịch THIẾU {N}/{Total}. Phản hồi: {Text}", result.Count, list.Count, Trunc(text));
            else
                _log.LogInformation("Đã dịch {N}/{Total} cụm sang tiếng Việt.", result.Count, list.Count);
            return result;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Lỗi khi gọi dịch Haiku.");
            return empty;
        }
    }

    private static bool HasCjk(string? s) => !string.IsNullOrEmpty(s) && s.Any(c => c >= 0x4E00 && c <= 0x9FFF);
    private static string Trunc(string s) => s.Length <= 600 ? s : s[..600];

    // Claude đôi khi bọc JSON trong văn bản; lấy đoạn { ... } đầu tiên.
    private static string? ExtractJsonObject(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        return (start >= 0 && end > start) ? text.Substring(start, end - start + 1) : null;
    }
}
