using GomDon.Modules.Retail.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/retail/reports")]
[Authorize]
public sealed class ReportsController : ControllerBase
{
    private readonly IReportService _reports;
    public ReportsController(IReportService reports) => _reports = reports;

    [HttpGet]
    public async Task<ActionResult> Get(CancellationToken ct) => Ok(await _reports.GetAsync(ct));
}
