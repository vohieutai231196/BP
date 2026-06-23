using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Services;

public interface IProductService
{
    Task<List<ProductListItem>> ListAsync(string? status, string? search, long? orderId = null, bool deleted = false, CancellationToken ct = default);
    Task<ProductListItem> CreateAsync(CreateProductRequest req, CancellationToken ct = default);
    Task UpdateAsync(long id, UpdateProductRequest req, CancellationToken ct = default);
    /// <summary>Trả true nếu xóa hẳn khỏi DB, false nếu chỉ ẩn (sản phẩm còn lịch sử bán).</summary>
    Task<bool> DeleteAsync(long id, CancellationToken ct = default);
    /// <summary>Xóa nhiều SKU một lần: gom kết quả (xóa hẳn / ẩn / bị chặn) thay vì dừng ở lỗi đầu tiên.</summary>
    Task<BulkDeleteResult> DeleteManyAsync(IReadOnlyList<long> ids, CancellationToken ct = default);
    /// <summary>Khôi phục SKU đã xóa mềm. Ném ValidationException nếu không tìm thấy hoặc mã SKU đã bị dùng lại.</summary>
    Task RestoreAsync(long id, CancellationToken ct = default);
    Task<List<ProductCostTypeDto>> GetCostTypesAsync(long id, CancellationToken ct = default);
}
