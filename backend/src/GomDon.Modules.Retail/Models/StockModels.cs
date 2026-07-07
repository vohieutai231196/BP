namespace GomDon.Modules.Retail.Models;

public sealed record StockMovementItem(
    long Id, string Type, int Qty, long UnitCost, string? RefType, long? RefId,
    string? RefLabel,    // "PN-260707-3" | "DB-..." (mã đơn bán) | "Đơn #647940" (legacy)
    DateTime At, string? Note);

public sealed record AdjustStockRequest(long ProductId, long ActualQty, string? Reason);

public sealed record StockAdjustResult(long ProductId, long OldQty, long NewQty, long Delta);
