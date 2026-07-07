using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Retail.Models;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Modules.Retail.Repositories;

public sealed class SaleRepository : ISaleRepository
{
    private readonly IDbConnectionFactory _factory;
    public SaleRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<List<SaleListItem>> ListAsync(CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var items = await conn.QueryAsync<SaleListItem>(new CommandDefinition(
            @"SELECT s.id, s.code, s.customer_name AS CustomerName, s.channel, s.sold_at AS SoldAt,
                     s.revenue, s.cogs, s.promo_cost AS PromoCost, s.extra_cost AS ExtraCost, s.profit,
                     COALESCE((SELECT COUNT(*) FROM sale_items i WHERE i.sale_id = s.id),0) AS ItemCount,
                     s.status, s.returned_at AS ReturnedAt
              FROM sales s ORDER BY s.sold_at DESC;", cancellationToken: ct));
        return items.ToList();
    }

    public async Task<long> CreateAsync(CreateSaleRequest req, string code, IReadOnlyList<PricedSaleItem> pricedItems,
        SaleTotals totals, IReadOnlyList<(long? CostTypeId, string Name, long Amount)> costRows, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        if (conn is System.Data.Common.DbConnection dbc) await dbc.OpenAsync(ct);
        else conn.Open();
        using var tx = conn.BeginTransaction();

        // chặn quá tồn ATOMIC: trừ thẳng product_stock với guard qty >= need —
        // 2 đơn đồng thời không thể cùng trừ quá tồn (UPDATE khoá row).
        foreach (var grp in pricedItems.GroupBy(i => i.ProductId))
        {
            int need = grp.Sum(i => i.Qty);
            var updated = await conn.ExecuteAsync(new CommandDefinition(
                @"UPDATE product_stock SET qty = qty - @need, updated_at = now()
                  WHERE product_id = @pid AND qty >= @need;",
                new { pid = grp.Key, need }, tx, cancellationToken: ct));
            if (updated == 0)
            {
                var stock = await conn.ExecuteScalarAsync<long>(new CommandDefinition(
                    "SELECT COALESCE((SELECT qty FROM product_stock WHERE product_id=@pid),0);",
                    new { pid = grp.Key }, tx, cancellationToken: ct));
                throw new GomDon.Shared.InsufficientStockException(grp.Key, stock, need);
            }
        }

        var saleId = await conn.ExecuteScalarAsync<long>(new CommandDefinition(
            @"INSERT INTO sales(code, customer_name, channel, revenue, cogs, promo_cost, extra_cost, profit, status)
              VALUES(@code, @CustomerName, @Channel, @Revenue, @Cogs, @PromoCost, @ExtraCost, @Profit, 'done') RETURNING id;",
            new { code, req.CustomerName, req.Channel, totals.Revenue, totals.Cogs, totals.PromoCost, totals.ExtraCost, totals.Profit },
            tx, cancellationToken: ct));

        foreach (var it in pricedItems)
        {
            await conn.ExecuteAsync(new CommandDefinition(
                @"INSERT INTO sale_items(sale_id, product_id, qty, unit_price, unit_cost, line_type, promo_id)
                  VALUES(@saleId, @ProductId, @Qty, @UnitPrice, @UnitCost, @LineType, @PromoId);",
                new { saleId, it.ProductId, it.Qty, it.UnitPrice, it.UnitCost, it.LineType, it.PromoId }, tx, cancellationToken: ct));
            await conn.ExecuteAsync(new CommandDefinition(
                @"INSERT INTO stock_movements(product_id, type, qty, unit_cost, ref_type, ref_id, note)
                  VALUES(@ProductId, 'out', @neg, @UnitCost, 'sale', @saleId, @note);",
                new { it.ProductId, neg = -it.Qty, it.UnitCost, saleId, note = $"Bán đơn {code}" }, tx, cancellationToken: ct));
        }

        foreach (var c in costRows)
            await conn.ExecuteAsync(new CommandDefinition(
                "INSERT INTO sale_costs(sale_id, cost_type_id, name, amount) VALUES(@saleId, @CostTypeId, @Name, @Amount);",
                new { saleId, c.CostTypeId, c.Name, c.Amount }, tx, cancellationToken: ct));

        tx.Commit();
        return saleId;
    }

    public async Task<bool> ReturnAsync(long saleId, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        if (conn is System.Data.Common.DbConnection dbc) await dbc.OpenAsync(ct);
        else conn.Open();
        using var tx = conn.BeginTransaction();

        var status = await conn.ExecuteScalarAsync<string?>(new CommandDefinition(
            "SELECT status FROM sales WHERE id=@saleId FOR UPDATE;", new { saleId }, tx, cancellationToken: ct));
        if (status is null) { tx.Rollback(); return false; }
        if (status == "returned")
            throw new System.ComponentModel.DataAnnotations.ValidationException("Đơn này đã được trả trước đó.");

        var code = await conn.ExecuteScalarAsync<string>(new CommandDefinition(
            "SELECT code FROM sales WHERE id=@saleId;", new { saleId }, tx, cancellationToken: ct));

        // cộng tồn lại cho từng dòng (kể cả hàng tặng) — không đổi avg_cost
        await conn.ExecuteAsync(new CommandDefinition(
            @"INSERT INTO stock_movements(product_id, type, qty, unit_cost, ref_type, ref_id, note)
              SELECT product_id, 'return', qty, unit_cost, 'return', @saleId, @note
              FROM sale_items WHERE sale_id=@saleId AND product_id IS NOT NULL;",
            new { saleId, note = $"Trả đơn {code}" }, tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(
            @"INSERT INTO product_stock(product_id, qty)
              SELECT product_id, SUM(qty) FROM sale_items
              WHERE sale_id=@saleId AND product_id IS NOT NULL GROUP BY product_id
              ON CONFLICT (product_id) DO UPDATE
                SET qty = product_stock.qty + EXCLUDED.qty, updated_at = now();",
            new { saleId }, tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE sales SET status='returned', returned_at=now() WHERE id=@saleId;",
            new { saleId }, tx, cancellationToken: ct));

        tx.Commit();
        return true;
    }
}
