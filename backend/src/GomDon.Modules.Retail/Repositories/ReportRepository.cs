using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public sealed class ReportRepository : IReportRepository
{
    private readonly IDbConnectionFactory _factory;
    public ReportRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<List<ChannelProfit>> ByChannelAsync(CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var rows = await conn.QueryAsync<ChannelProfit>(new CommandDefinition(
            @"SELECT COALESCE(NULLIF(channel,''),'(không rõ)') AS Channel,
                     COUNT(*) AS SalesCount, COALESCE(SUM(revenue),0) AS Revenue, COALESCE(SUM(profit),0) AS Profit
              FROM sales GROUP BY COALESCE(NULLIF(channel,''),'(không rõ)') ORDER BY Profit DESC;",
            cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<List<SkuProfit>> BySkuAsync(CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var rows = await conn.QueryAsync<SkuProfit>(new CommandDefinition(
            @"SELECT p.id AS ProductId, p.sku AS Sku, p.name AS Name,
                     COALESCE(SUM(si.qty),0) AS QtySold,
                     COALESCE(SUM(si.qty*si.unit_price),0) AS Revenue,
                     COALESCE(SUM(si.qty*(si.unit_price - si.unit_cost)),0) AS Margin
              FROM sale_items si JOIN products p ON p.id = si.product_id
              GROUP BY p.id, p.sku, p.name
              ORDER BY Margin DESC;", cancellationToken: ct));
        return rows.ToList();
    }
}
