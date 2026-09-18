from friday_core.execution import RevenueExecutionPipeline
import pytest


def test_pipeline_requires_verified_payment_before_delivery():
    p = RevenueExecutionPipeline()
    p.create("opp-1", {"name": "AI automation package"})
    p.advance("opp-1", "offer", {"validated": True})
    p.advance("opp-1", "checkout", {"checkout_ready": True})
    with pytest.raises(ValueError):
        p.advance("opp-1", "delivery", {})


def test_pipeline_payment_then_delivery():
    p = RevenueExecutionPipeline()
    p.create("opp-2", {"name": "Website service"})
    p.advance("opp-2", "offer", {"validated": True})
    p.advance("opp-2", "landing_page", {"published": True})
    p.advance("opp-2", "checkout", {"checkout_ready": True})
    p.mark_payment_verified("opp-2", {"provider": "test", "status": "verified"})
    result = p.advance("opp-2", "delivery", {"delivered": True})
    assert result["payment_verified"] is True
    assert result["stage"] == "delivery"
