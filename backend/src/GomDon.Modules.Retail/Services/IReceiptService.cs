using GomDon.Modules.Retail.Models;
using GomDon.Shared;

namespace GomDon.Modules.Retail.Services;

public interface IReceiptService
{
    Task<ReceiptCreated> CreateAsync(CreateReceiptRequest req, long? createdBy, CancellationToken ct = default);
    Task<PagedResult<ReceiptListItem>> ListAsync(ReceiptQuery q, CancellationToken ct = default);
    Task<ReceiptDetail?> GetAsync(long id, CancellationToken ct = default);
}
