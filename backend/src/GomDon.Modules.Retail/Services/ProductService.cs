using FluentValidation;
using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Modules.Retail.Services;

public sealed class ProductService : IProductService
{
    private readonly IProductRepository _repo;
    private readonly IValidator<CreateProductRequest> _createValidator;

    public ProductService(IProductRepository repo, IValidator<CreateProductRequest> createValidator)
    {
        _repo = repo;
        _createValidator = createValidator;
    }

    public Task<List<ProductListItem>> ListAsync(string? status, string? search, CancellationToken ct = default)
        => _repo.ListAsync(status, search, ct);

    public async Task<ProductListItem> CreateAsync(CreateProductRequest req, CancellationToken ct = default)
    {
        await _createValidator.ValidateAndThrowAsync(req, ct);
        if (await _repo.SkuExistsAsync(req.Sku.Trim(), ct))
            throw new ValidationException($"SKU '{req.Sku}' đã tồn tại.");
        var clean = req with { Sku = req.Sku.Trim(), Name = req.Name.Trim() };
        var id = await _repo.InsertAsync(clean, ct);
        if (req.CostTypes is not null)
            await _repo.SetCostTypesAsync(id, req.CostTypes, ct);
        var p = await Require(id, ct);
        return ToItem(p);
    }

    public async Task UpdateAsync(long id, UpdateProductRequest req, CancellationToken ct = default)
    {
        var p = await Require(id, ct);
        var name = string.IsNullOrWhiteSpace(req.Name) ? p.Name : req.Name.Trim();
        var category = string.IsNullOrWhiteSpace(req.Category) ? p.Category : req.Category!;
        var image = req.ImageUrl ?? p.ImageUrl;
        var avgCost = req.AvgCost ?? p.AvgCost;
        var listPrice = req.ListPrice ?? p.ListPrice;
        var status = string.IsNullOrWhiteSpace(req.Status) ? p.Status : req.Status!;
        if (status is not ("active" or "hidden")) throw new ValidationException("Trạng thái không hợp lệ.");
        if (avgCost < 0) throw new ValidationException("Giá vốn không hợp lệ.");
        await _repo.UpdateAsync(id, name, category, image, avgCost, listPrice, status, ct);
        if (req.CostTypes is not null)
            await _repo.SetCostTypesAsync(id, req.CostTypes, ct);
    }

    public async Task<bool> DeleteAsync(long id, CancellationToken ct = default)
    {
        await Require(id, ct);
        // Đang sử dụng (đơn chưa trả / nằm trong combo) → không cho xóa.
        if (await _repo.IsInUseAsync(id, ct))
            throw new ValidationException("Không thể xóa sản phẩm đang được sử dụng (còn đơn bán chưa trả hoặc nằm trong combo). Hãy xử lý các đơn/combo liên quan trước.");
        // Chỉ còn lịch sử đơn đã trả → ẩn để giữ nguyên dữ liệu báo cáo (không thể hard delete vì FK).
        if (await _repo.HasSalesHistoryAsync(id, ct))
        {
            await _repo.SoftDeleteAsync(id, ct);
            return false;
        }
        await _repo.DeleteAsync(id, ct);
        return true;
    }

    public Task<List<ProductCostTypeDto>> GetCostTypesAsync(long id, CancellationToken ct = default) => _repo.GetCostTypesAsync(id, ct);

    private async Task<Product> Require(long id, CancellationToken ct)
        => await _repo.GetByIdAsync(id, ct) ?? throw new ValidationException($"Không tìm thấy sản phẩm #{id}.");

    private static ProductListItem ToItem(Product p)
        => new(p.Id, p.Sku, p.Name, p.Category, p.ImageUrl, p.Status, p.AvgCost, p.ListPrice, p.CreatedAt, 0);
}
