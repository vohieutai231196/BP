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
                       COALESCE((SELECT ps.qty FROM product_stock ps WHERE ps.product_id=p.id),0) AS stock
                FROM products p WHERE p.status='active' AND p.deleted_at IS NULL)
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

    public async Task<List<ImportBatch>> ListImportsAsync(CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var rows = await conn.QueryAsync<ImportBatch>(new CommandDefinition(
            @"SELECT x.order_id AS OrderId,
                     MAX(x.at) AS ReceivedAt,
                     COUNT(DISTINCT x.product_id)::int AS SkuCount,
                     COALESCE(SUM(x.qty), 0)::bigint AS TotalQty,
                     COALESCE(SUM(x.qty * x.unit_cost), 0)::bigint AS TotalCost
              FROM (
                -- phiếu nhập mới (source='order')
                SELECT r.order_id, ri.product_id, ri.qty, ri.unit_cost, r.received_at AS at
                FROM receipts r
                JOIN receipt_items ri ON ri.receipt_id = r.id
                JOIN products p ON p.id = ri.product_id AND p.deleted_at IS NULL
                WHERE r.source = 'order' AND r.order_id IS NOT NULL
                UNION ALL
                -- dữ liệu cũ trước khi có receipts
                SELECT m.ref_id, m.product_id, m.qty, m.unit_cost, m.at
                FROM stock_movements m
                JOIN products p ON p.id = m.product_id AND p.deleted_at IS NULL
                WHERE m.ref_type = 'import_order' AND m.ref_id IS NOT NULL
              ) x
              GROUP BY x.order_id
              ORDER BY MAX(x.at) DESC;", cancellationToken: ct));
        return rows.ToList();
    }
}
