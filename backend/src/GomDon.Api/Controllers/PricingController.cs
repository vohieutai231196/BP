using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Pricing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/pricing")]
[Authorize]
public sealed class PricingController : ControllerBase
{
    [HttpPost("calc")]
    public ActionResult<PricingResult> Calc([FromBody] PricingRequest req)
        => Ok(PricingCalculator.Compute(req));
}
