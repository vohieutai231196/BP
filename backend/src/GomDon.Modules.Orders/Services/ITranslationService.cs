namespace GomDon.Modules.Orders.Services;

/// <summary>Dịch các cụm ngắn (đặc điểm/màu sản phẩm) Trung → Việt.</summary>
public interface ITranslationService
{
    /// <summary>Dịch một loạt cụm; trả map gốc→tiếng Việt. Cụm không dịch được sẽ vắng mặt.</summary>
    Task<IReadOnlyDictionary<string, string>> TranslateAsync(IEnumerable<string> terms, CancellationToken ct = default);
}
