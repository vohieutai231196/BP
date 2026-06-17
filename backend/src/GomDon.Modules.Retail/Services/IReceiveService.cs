using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Services;

public interface IReceiveService
{
    Task<ReceivePreview> PreviewAsync(long orderId, CancellationToken ct = default);
    Task<int> ConfirmAsync(ConfirmReceiveRequest req, CancellationToken ct = default);
}
