namespace GomDon.Shared;

public sealed class PagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = Array.Empty<T>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int Total { get; init; }
    public int Pages => PageSize <= 0 ? 1 : (int)Math.Ceiling(Total / (double)PageSize);
}
