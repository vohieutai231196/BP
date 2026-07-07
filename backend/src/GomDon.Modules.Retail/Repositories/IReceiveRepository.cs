namespace GomDon.Modules.Retail.Repositories;

public interface IReceiveRepository
{
    /// <summary>Tìm product_id đã từng nhập từ link_code (khớp gần nhất).</summary>
    Task<long?> FindProductByLinkCodeAsync(string linkCode, CancellationToken ct = default);
}
