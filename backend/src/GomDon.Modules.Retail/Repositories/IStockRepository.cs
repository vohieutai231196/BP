namespace GomDon.Modules.Retail.Repositories;

public interface IStockRepository
{
    /// <summary>Tồn hiện tại của 1 SKU (SUM qty).</summary>
    Task<long> GetStockAsync(long productId, CancellationToken ct = default);
    /// <summary>Ghi một dòng phát sinh kho.</summary>
    Task InsertMovementAsync(long productId, string type, int qty, long unitCost, string? refType, long? refId, string? note, CancellationToken ct = default);
}
