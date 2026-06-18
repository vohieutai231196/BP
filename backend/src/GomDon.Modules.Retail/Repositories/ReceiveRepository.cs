using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Retail.Models;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Modules.Retail.Repositories;

public sealed class ReceiveRepository : IReceiveRepository
{
    private readonly IDbConnectionFactory _factory;
    public ReceiveRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<long?> FindProductByLinkCodeAsync(string linkCode, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(linkCode)) return null;
        using var conn = _factory.Create();
        return await conn.ExecuteScalarAsync<long?>(new CommandDefinition(
            @"SELECT product_id FROM product_sources WHERE link_code = @linkCode ORDER BY at DESC LIMIT 1;",
            new { linkCode }, cancellationToken: ct));
    }

    public async Task<int> ConfirmAsync(ConfirmReceiveRequest req, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        if (conn is System.Data.Common.DbConnection dbc) await dbc.OpenAsync(ct);
        else conn.Open();
        using var tx = conn.BeginTransaction();

        int received = 0;
        foreach (var line in req.Lines)
        {
            if (line.Qty <= 0) continue;
            long productId;

            if (line.ProductId is { } pid)
            {
                productId = pid;
            }
            else
            {
                if (string.IsNullOrWhiteSpace(line.NewSku))
                    throw new ValidationException("Dòng nhập thiếu SKU cho sản phẩm mới.");
                var exists = await conn.ExecuteScalarAsync<bool>(new CommandDefinition(
                    "SELECT EXISTS(SELECT 1 FROM products WHERE lower(sku)=lower(@s) AND deleted_at IS NULL);",
                    new { s = line.NewSku }, tx, cancellationToken: ct));
                if (exists) throw new ValidationException($"SKU '{line.NewSku}' đã tồn tại.");
                productId = await conn.ExecuteScalarAsync<long>(new CommandDefinition(
                    @"INSERT INTO products(sku, name, category, image_url, avg_cost)
                      VALUES(@Sku, @Name, @Category, @ImageUrl, 0) RETURNING id;",
                    new
                    {
                        Sku = line.NewSku, Name = string.IsNullOrWhiteSpace(line.NewName) ? line.NewSku : line.NewName,
                        Category = string.IsNullOrWhiteSpace(line.Category) ? "other" : line.Category, line.ImageUrl,
                    }, tx, cancellationToken: ct));
            }

            // bình quân gia quyền
            var cur = await conn.QueryFirstAsync<(long stock, long avg)>(new CommandDefinition(
                @"SELECT COALESCE((SELECT SUM(qty) FROM stock_movements WHERE product_id=@productId),0) AS stock,
                         (SELECT avg_cost FROM products WHERE id=@productId) AS avg;",
                new { productId }, tx, cancellationToken: ct));
            long newAvg = (cur.stock + line.Qty) > 0
                ? (long)Math.Round((cur.stock * (decimal)cur.avg + line.Qty * (decimal)line.UnitCost) / (cur.stock + line.Qty), MidpointRounding.AwayFromZero)
                : line.UnitCost;

            await conn.ExecuteAsync(new CommandDefinition(
                @"INSERT INTO stock_movements(product_id, type, qty, unit_cost, ref_type, ref_id, note)
                  VALUES(@productId, 'in', @Qty, @UnitCost, 'import_order', @OrderId, @note);",
                new { productId, line.Qty, line.UnitCost, req.OrderId, note = $"Nhận từ đơn #{req.OrderId}" }, tx, cancellationToken: ct));

            await conn.ExecuteAsync(new CommandDefinition(
                "UPDATE products SET avg_cost = @newAvg WHERE id = @productId;",
                new { newAvg, productId }, tx, cancellationToken: ct));

            await conn.ExecuteAsync(new CommandDefinition(
                @"INSERT INTO product_sources(product_id, order_id, order_link_id, link_code)
                  VALUES(@productId, @OrderId, @OrderLinkId, @LinkCode);",
                new { productId, req.OrderId, line.OrderLinkId, line.LinkCode }, tx, cancellationToken: ct));

            received++;
        }

        tx.Commit();
        return received;
    }
}
