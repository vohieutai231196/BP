using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public interface IReceiveRepository
{
    /// <summary>Tìm product_id đã từng nhập từ link_code (khớp gần nhất).</summary>
    Task<long?> FindProductByLinkCodeAsync(string linkCode, CancellationToken ct = default);
    /// <summary>Ghi nhận kho trong 1 transaction: tạo SKU mới nếu cần, insert movement(in),
    /// cập nhật avg_cost (bình quân gia quyền), ghi product_sources. Trả số dòng đã nhận.</summary>
    Task<int> ConfirmAsync(ConfirmReceiveRequest req, CancellationToken ct = default);
}
