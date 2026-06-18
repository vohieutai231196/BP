using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public sealed class RetailSummaryRepository : IRetailSummaryRepository
{
    private readonly IDbConnectionFactory _factory;
    public RetailSummaryRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<RetailSummary> GetAsync(int lowStockThreshold, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var prod = await conn.QueryFirstAsync<(int total_skus, long total_stock, long stock_value, int low_count)>(
            new CommandDefinition(
            @"WITH s AS (
                SELECT p.id, p.avg_cost,
                       COALESCE((SELECT SUM(qty) FROM stock_movements m WHERE m.product_id=p.id),0) AS stock
                FROM products p WHERE p.status='active')
              SELECT COUNT(*) AS total_skus,
                     COALESCE(SUM(stock),0) AS total_stock,
                     COALESCE(SUM(stock*avg_cost),0) AS stock_value,
                     COALESCE(SUM(CASE WHEN stock <= @t THEN 1 ELSE 0 END),0) AS low_count
              FROM s;", new { t = lowStockThreshold }, cancellationToken: ct));

        var sale = await conn.QueryFirstAsync<(long revenue, long profit, int cnt)>(new CommandDefinition(
            @"SELECT COALESCE(SUM(revenue),0) AS revenue, COALESCE(SUM(profit),0) AS profit, COUNT(*) AS cnt
              FROM sales WHERE status <> 'returned';",
            cancellationToken: ct));

        return new RetailSummary(prod.total_skus, prod.total_stock, prod.stock_value, prod.low_count,
            sale.revenue, sale.profit, sale.cnt);
    }
}
