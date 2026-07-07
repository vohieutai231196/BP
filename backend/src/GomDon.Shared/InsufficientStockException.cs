namespace GomDon.Shared;

/// <summary>Ném khi thao tác kho sẽ làm tồn âm — API trả 409 Conflict kèm tồn hiện tại.</summary>
public sealed class InsufficientStockException : Exception
{
    public long ProductId { get; }
    public long Available { get; }
    public long Requested { get; }

    public InsufficientStockException(long productId, long available, long requested)
        : base($"Sản phẩm #{productId} không đủ tồn (còn {available}, cần {requested}).")
    {
        ProductId = productId; Available = available; Requested = requested;
    }
}
