using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Startup;

/// <summary>
/// Bắt mọi exception chưa xử lý và trả về ProblemDetails (JSON chuẩn RFC 7807)
/// thay cho 500 body rỗng. ValidationException → 400, còn lại → 500.
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _log;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> log) => _log = log;

    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        // FluentValidation: trả ValidationProblemDetails (lỗi theo từng field)
        if (ex is FluentValidation.ValidationException fve)
        {
            var errors = fve.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

            _log.LogWarning("Dữ liệu không hợp lệ trên {Path}: {Errors}", ctx.Request.Path, string.Join("; ", fve.Errors.Select(e => e.ErrorMessage)));

            var vproblem = new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Dữ liệu không hợp lệ",
                Instance = ctx.Request.Path,
            };
            ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
            await ctx.Response.WriteAsJsonAsync(vproblem, ct);
            return true;
        }

        var (status, title) = ex switch
        {
            ValidationException => (StatusCodes.Status400BadRequest, "Dữ liệu không hợp lệ"),
            GomDon.Shared.InsufficientStockException => (StatusCodes.Status409Conflict, "Không đủ tồn kho"),
            _ => (StatusCodes.Status500InternalServerError, "Lỗi máy chủ"),
        };

        if (status >= 500)
            _log.LogError(ex, "Lỗi chưa xử lý trên {Path}", ctx.Request.Path);
        else
            _log.LogWarning("Yêu cầu không hợp lệ trên {Path}: {Msg}", ctx.Request.Path, ex.Message);

        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = ex.Message,
            Instance = ctx.Request.Path,
        };

        ctx.Response.StatusCode = status;
        await ctx.Response.WriteAsJsonAsync(problem, ct);
        return true;
    }
}
