namespace GomDon.Modules.Orders.Models;

public sealed class DashboardSummary
{
    public int TotalOrders { get; set; }
    public long TotalRevenue { get; set; }
    public long TotalCollected { get; set; }
    public long TotalOutstanding { get; set; }
    public decimal TotalWeight { get; set; }
    public int OutstandingOrders { get; set; }
    public Dictionary<string, int> StatusCounts { get; set; } = new();
    public List<SeriesPoint> Series { get; set; } = new();
    public List<PlatformAgg> PlatformAgg { get; set; } = new();
    public List<WarehouseAgg> WarehouseAgg { get; set; } = new();
}

public sealed class SeriesPoint
{
    public DateOnly Day { get; set; }
    public string Label { get; set; } = "";
    public int Count { get; set; }
}

public sealed class PlatformAgg
{
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
    public string Tint { get; set; } = "";
    public int Count { get; set; }
}

public sealed class WarehouseAgg
{
    public string Name { get; set; } = "";
    public int Count { get; set; }
}
