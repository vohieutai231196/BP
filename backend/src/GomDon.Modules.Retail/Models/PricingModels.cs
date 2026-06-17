namespace GomDon.Modules.Retail.Models;

/// <summary>Một khoản chi phí phát sinh trong máy tính giá.</summary>
public sealed record PricingCostLine(string Name, long Amount, string Unit); // Unit: "vnd" | "percent"

/// <summary>Yêu cầu tính giá.</summary>
public sealed class PricingRequest
{
    public long UnitCost { get; set; }
    public List<PricingCostLine> Costs { get; set; } = new();
    public int RoundTo { get; set; } = 0;          // 0 | 1000 | 5000
    public List<int>? Levels { get; set; }         // null => mặc định 10,20,30,50,70,100
}

/// <summary>Kết quả tại một mức lời.</summary>
public sealed record PricingLevel(
    int Pct,
    long PriceMarkup, long ProfitMarkup,
    long? PriceMargin, long? ProfitMargin);

/// <summary>Kết quả tính giá đầy đủ.</summary>
public sealed record PricingResult(
    long UnitCost, long ExtraCost, long CostBase,
    IReadOnlyList<PricingLevel> LevelsResult);
