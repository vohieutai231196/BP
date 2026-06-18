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
            @"SELECT s.id, s.code, s.customer_name, s.channel, s.sold_at, s.revenue, s.cogs, s.promo_cost, s.extra_cost, s.profit,
                     COALESCE((SELECT COUNT(*) FROM sale_items i WHERE i.sale_id = s.id),0) AS item_count
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

        // chặn quá tồn (gộp nhu cầu theo product_id — item lẻ + thành phần combo)
        foreach (var grp in pricedItems.GroupBy(i => i.ProductId))
        {
            int need = grp.Sum(i => i.Qty);
            var stock = await conn.ExecuteScalarAsync<long>(new CommandDefinition(
                "SELECT COALESCE(SUM(qty),0) FROM stock_movements WHERE product_id=@pid;",
                new { pid = grp.Key }, tx, cancellationToken: ct));
            if (stock < need)
                throw new ValidationException($"Sản phẩm #{grp.Key} không đủ tồn (còn {stock}, cần {need}).");
        }

        var saleId = await conn.ExecuteScalarAsync<long>(new CommandDefinition(
            @"INSERT INTO sales(code, customer_name, channel, revenue, cogs, promo_cost, extra_cost, profit, status)
              VALUES(@code, @CustomerName, @Channel, @Revenue, @Cogs, @PromoCost, @ExtraCost, @Profit, 'done') RETURNING id;",
            new { code, req.CustomerName, req.Channel, totals.Revenue, totals.Cogs, totals.PromoCost, totals.ExtraCost, totals.Profit },
            tx, cancellationToken: ct));

        foreach (var it in pricedItems)
        {
            await conn.ExecuteAsync(new CommandDefinition(
                @"INSERT INTO sale_items(sale_id, product_id, qty, unit_price, unit_cost, line_type)
                  VALUES(@saleId, @ProductId, @Qty, @UnitPrice, @UnitCost, @LineType);",
                new { saleId, it.ProductId, it.Qty, it.UnitPrice, it.UnitCost, it.LineType }, tx, cancellationToken: ct));
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
}
