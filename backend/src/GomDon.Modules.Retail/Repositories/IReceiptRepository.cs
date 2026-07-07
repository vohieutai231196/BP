using GomDon.Modules.Retail.Models;
using GomDon.Shared;

namespace GomDon.Modules.Retail.Repositories;

public interface IReceiptRepository
{
    Task<ReceiptCreated> CreateAsync(CreateReceiptCommand cmd, CancellationToken ct = default);
    Task<PagedResult<ReceiptListItem>> ListAsync(ReceiptQuery q, CancellationToken ct = default);
    Task<ReceiptDetail?> GetAsync(long id, CancellationToken ct = default);
}
