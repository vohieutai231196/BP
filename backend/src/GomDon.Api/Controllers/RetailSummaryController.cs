using GomDon.Modules.Retail.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/retail")]
[Authorize]
public sealed class RetailSummaryController : ControllerBase
{
    private readonly IRetailSummaryService _summary;
    public RetailSummaryController(IRetailSummaryService summary) => _summary = summary;

    [HttpGet("summary")]
    public async Task<ActionResult> Summary(CancellationToken ct) => Ok(await _summary.GetAsync(ct));

    [HttpGet("imports")]
    public async Task<ActionResult> Imports(CancellationToken ct) => Ok(await _summary.ListImportsAsync(ct));
}
