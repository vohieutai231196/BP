using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

/// <summary>
/// Proxy ảnh sản phẩm từ CDN Trung Quốc (alicdn) qua server.
/// Lý do: một số nhà mạng VN chặn alicdn trên 4G/5G nên ảnh không tải được
/// trên điện thoại, dù trang gomdons.com vẫn vào bình thường. Cho server tự
/// tải ảnh rồi trả về cùng origin → client chỉ cần nói chuyện với gomdons.com.
///
/// AllowAnonymous vì thẻ &lt;img&gt; của trình duyệt không gửi được Authorization.
/// Để tránh trở thành open-proxy/SSRF, CHỈ cho phép host thuộc allowlist alicdn.
/// </summary>
[ApiController]
[Route("v1/img")]
public sealed class ImageProxyController : ControllerBase
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<ImageProxyController> _log;

    // Chỉ proxy ảnh từ các CDN này (khớp chính host hoặc *.<host>).
    private static readonly string[] AllowedHostSuffixes =
    {
        "alicdn.com",      // cbu01.alicdn.com, img.alicdn.com, ...
        "taobaocdn.com",
        "tbcdn.cn",
    };

    public ImageProxyController(IHttpClientFactory httpFactory, ILogger<ImageProxyController> log)
    {
        _httpFactory = httpFactory;
        _log = log;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string u, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(u)
            || !Uri.TryCreate(u, UriKind.Absolute, out var target)
            || (target.Scheme != Uri.UriSchemeHttp && target.Scheme != Uri.UriSchemeHttps))
            return BadRequest(new { message = "Tham số 'u' không phải URL hợp lệ." });

        if (!IsAllowedHost(target.Host))
            return BadRequest(new { message = "Host không nằm trong allowlist." });

        // Luôn fetch qua https dù URL gốc là http (CDN hỗ trợ https).
        var fetchUri = target.Scheme == Uri.UriSchemeHttp
            ? new UriBuilder(target) { Scheme = Uri.UriSchemeHttps, Port = -1 }.Uri
            : target;

        try
        {
            var client = _httpFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(15);

            using var req = new HttpRequestMessage(HttpMethod.Get, fetchUri);
            // KHÔNG gửi Referer (giống referrerPolicy="no-referrer") để vượt hotlink-protection.
            req.Headers.TryAddWithoutValidation("Accept", "image/*");
            req.Headers.TryAddWithoutValidation("User-Agent", "GomDon-ImageProxy/1.0");

            using var upstream = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!upstream.IsSuccessStatusCode)
            {
                _log.LogWarning("Proxy ảnh thất bại {Status} cho {Uri}", (int)upstream.StatusCode, fetchUri);
                return StatusCode(StatusCodes.Status502BadGateway, new { message = "Không tải được ảnh nguồn." });
            }

            var contentType = upstream.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
            if (!contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                return StatusCode(StatusCodes.Status502BadGateway, new { message = "Nguồn không trả về ảnh." });

            // Cache 30 ngày: ảnh sản phẩm gần như không đổi.
            Response.Headers.CacheControl = "public, max-age=2592000, immutable";
            var bytes = await upstream.Content.ReadAsByteArrayAsync(ct);
            return File(bytes, contentType);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            return new EmptyResult(); // client huỷ
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Lỗi proxy ảnh {Uri}", fetchUri);
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Lỗi tải ảnh." });
        }
    }

    private static bool IsAllowedHost(string host)
    {
        foreach (var suffix in AllowedHostSuffixes)
        {
            if (host.Equals(suffix, StringComparison.OrdinalIgnoreCase)
                || host.EndsWith("." + suffix, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }
}
