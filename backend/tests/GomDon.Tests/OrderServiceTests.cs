using System.ComponentModel.DataAnnotations;
using GomDon.Modules.Orders.Models;
using GomDon.Modules.Orders.Repositories;
using GomDon.Modules.Orders.Services;
using GomDon.Modules.Orders.Validators;
using GomDon.Shared;
using Xunit;

namespace GomDon.Tests;

public class OrderServiceTests
{
    // ---- fake repository ghi lại lời gọi ----
    private sealed class FakeRepo : IOrderRepository
    {
        public IngestOrderRequest? Ingested;
        public (long id, string status, string text)? StatusCall;
        public bool UpdateReturns = true;

        public Task<long> IngestAsync(IngestOrderRequest req, CancellationToken ct = default)
        { Ingested = req; return Task.FromResult(648001L); }

        public Task<bool> UpdateStatusAsync(long id, string status, string historyText, CancellationToken ct = default)
        { StatusCall = (id, status, historyText); return Task.FromResult(UpdateReturns); }

        public Task<PagedResult<OrderSummary>> ListAsync(OrderQuery q, CancellationToken ct = default) => Task.FromResult(new PagedResult<OrderSummary>());
        public Task<OrderDetail?> GetByIdAsync(long id, CancellationToken ct = default) => Task.FromResult<OrderDetail?>(null);
        public Task<DashboardSummary> GetDashboardAsync(CancellationToken ct = default) => Task.FromResult(new DashboardSummary());
        public Task<int> CountAsync(CancellationToken ct = default) => Task.FromResult(0);
        public Task<bool> DeleteAsync(long id, CancellationToken ct = default) => Task.FromResult(true);
    }

    private sealed class NoopTranslation : ITranslationService
    {
        public Task<IReadOnlyDictionary<string, string>> TranslateAsync(IEnumerable<string> terms, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyDictionary<string, string>>(new Dictionary<string, string>());
    }

    // Dịch giả trả về map cố định (mô phỏng AI dịch sót / dịch đủ).
    private sealed class StubTranslation : ITranslationService
    {
        private readonly Dictionary<string, string> _map;
        public StubTranslation(Dictionary<string, string> map) => _map = map;
        public Task<IReadOnlyDictionary<string, string>> TranslateAsync(IEnumerable<string> terms, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyDictionary<string, string>>(_map);
    }

    private static bool HasChinese(string? s) => s != null && s.Any(c => c >= 0x4E00 && c <= 0x9FFF);

    private static (OrderService svc, FakeRepo repo) Make()
    {
        var repo = new FakeRepo();
        return (new OrderService(repo, new IngestOrderRequestValidator(), new NoopTranslation()), repo);
    }

    [Fact]
    public async Task Ingest_valid_calls_repo_and_returns_id()
    {
        var (svc, repo) = Make();
        var id = await svc.IngestAsync(new IngestOrderRequest { ProductName = "P", CustomerName = "C", Rate = 4035 });
        Assert.Equal(648001L, id);
        Assert.NotNull(repo.Ingested);
    }

    [Fact]
    public async Task Ingest_strips_residual_chinese_when_ai_translation_incomplete()
    {
        var repo = new FakeRepo();
        // AI dịch SÓT: vẫn còn "码" và "米色" trong bản dịch trả về.
        var svc = new OrderService(repo, new IngestOrderRequestValidator(),
            new StubTranslation(new Dictionary<string, string> { ["17码 -- 米色"] = "size 17码 -- 米色 kem" }));

        await svc.IngestAsync(new IngestOrderRequest
        {
            ProductName = "P", CustomerName = "C", Rate = 4035,
            Links = { new IngestLink { Idx = 1, LinkCode = "1", Spec = "17码 -- 米色" } },
        });

        var vi = repo.Ingested!.Links[0].SpecVi;
        Assert.False(HasChinese(vi), $"vẫn còn tiếng Trung: {vi}");
        Assert.Contains("kem", vi);          // phần tiếng Việt được giữ
    }

    [Fact]
    public async Task Ingest_translates_product_name_via_ai()
    {
        var repo = new FakeRepo();
        var svc = new OrderService(repo, new IngestOrderRequestValidator(),
            new StubTranslation(new Dictionary<string, string> { ["女宝鞋子"] = "Giày bé gái" }));

        await svc.IngestAsync(new IngestOrderRequest
        {
            ProductName = "P", CustomerName = "C", Rate = 4035,
            Links = { new IngestLink { Idx = 1, LinkCode = "1", Name = "女宝鞋子", SourceUrl = "https://detail.1688.com/offer/1.html" } },
        });

        Assert.Equal("Giày bé gái", repo.Ingested!.Links[0].Name);
    }

    // Tên chủ yếu tiếng Trung, dịch trượt → KHÔNG được rút thành mẩu Latin lẻ ("ins").
    // Giữ nguyên og:title gốc để người dùng thấy tên thật & tự sửa (plan B).
    [Fact]
    public async Task Ingest_keeps_original_name_when_strip_would_leave_only_latin_debris()
    {
        var (svc, repo) = Make();   // NoopTranslation → AI không dịch được gì
        const string raw = "ins风简约百搭连衣裙";

        await svc.IngestAsync(new IngestOrderRequest
        {
            ProductName = "P", CustomerName = "C", Rate = 4035,
            Links = { new IngestLink { Idx = 1, LinkCode = "1", Name = raw } },
        });

        var name = repo.Ingested!.Links[0].Name;
        Assert.Equal(raw, name);            // giữ nguyên, KHÔNG strip
        Assert.NotEqual("ins", name);       // không còn là rác Latin
    }

    // Tên còn nhiều phần Latin có nghĩa → vẫn loại tiếng Trung như cũ.
    [Fact]
    public async Task Ingest_strips_chinese_from_name_when_latin_remainder_is_meaningful()
    {
        var (svc, repo) = Make();   // NoopTranslation

        await svc.IngestAsync(new IngestOrderRequest
        {
            ProductName = "P", CustomerName = "C", Rate = 4035,
            Links = { new IngestLink { Idx = 1, LinkCode = "1", Name = "Nike Air Max 中国限定版" } },
        });

        var name = repo.Ingested!.Links[0].Name;
        Assert.False(HasChinese(name), $"tên còn tiếng Trung: {name}");
        Assert.Contains("Nike Air Max", name);
    }

    [Fact]
    public async Task Ingest_with_no_translation_still_leaves_no_chinese_in_spec()
    {
        var (svc, repo) = Make();   // NoopTranslation → AI không dịch được gì

        await svc.IngestAsync(new IngestOrderRequest
        {
            ProductName = "P", CustomerName = "C", Rate = 4035,
            Links =
            {
                new IngestLink { Idx = 1, LinkCode = "1", Spec = "16码 鞋内长12厘米" }, // còn số → giữ số
                new IngestLink { Idx = 2, LinkCode = "2", Spec = "纯中文颜色" },          // thuần Hán → "(không rõ)"
            },
        });

        Assert.All(repo.Ingested!.Links, l => Assert.False(HasChinese(l.SpecVi), $"còn tiếng Trung: {l.SpecVi}"));
    }

    [Fact]
    public async Task Ingest_invalid_throws_and_does_not_touch_repo()
    {
        var (svc, repo) = Make();
        await Assert.ThrowsAsync<FluentValidation.ValidationException>(
            () => svc.IngestAsync(new IngestOrderRequest { ProductName = "", CustomerName = "", Rate = 0 }));
        Assert.Null(repo.Ingested);
    }

    [Fact]
    public async Task ChangeStatus_valid_writes_history_with_label()
    {
        var (svc, repo) = Make();
        var ok = await svc.ChangeStatusAsync(647900, "kho_vn", "ghi chú X");
        Assert.True(ok);
        Assert.Equal("kho_vn", repo.StatusCall!.Value.status);
        Assert.Contains("Trong kho VN", repo.StatusCall.Value.text);   // label tiếng Việt
        Assert.Contains("ghi chú X", repo.StatusCall.Value.text);
    }

    [Fact]
    public async Task ChangeStatus_invalid_status_throws_and_does_not_touch_repo()
    {
        var (svc, repo) = Make();
        await Assert.ThrowsAsync<ValidationException>(() => svc.ChangeStatusAsync(1, "xyz", null));
        Assert.Null(repo.StatusCall);
    }

    [Fact]
    public async Task ChangeStatus_returns_false_when_order_missing()
    {
        var (svc, repo) = Make();
        repo.UpdateReturns = false;
        Assert.False(await svc.ChangeStatusAsync(999, "da_tra", null));
    }
}
