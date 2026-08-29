from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.adapters.serpapi import SerpApiAdapter
from app.config import Settings


@pytest.fixture
def live_settings():
    return Settings(
        use_mock_serpapi=False,
        serpapi_api_key="test_serpapi_key",
        serpapi_url="https://serpapi.com/search.json",
    )


@pytest.mark.asyncio
async def test_serpapi_live_pass(live_settings):
    mock_response = AsyncMock(spec=httpx.Response)
    mock_response.raise_for_status = lambda: None
    mock_response.json.return_value = {
        "organic_results": [
            {"link": "https://stripe.com/"},
            {"link": "https://en.wikipedia.org/wiki/Stripe"},
        ]
    }

    with patch("httpx.AsyncClient.get", return_value=mock_response) as mock_get:
        adapter = SerpApiAdapter(live_settings)
        result = await adapter.company_signal("Stripe", "stripe.com")

        assert result["status"] == "PASS"
        assert result["value"] == "https://stripe.com/"
        assert result["source_url"] == "https://stripe.com/"
        assert result["provider"] == "serpapi"
        assert result["mode"] == "live"
        assert result["metadata"]["result_count"] == 2
        
        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        assert kwargs["params"]["api_key"] == "test_serpapi_key"
        assert kwargs["params"]["q"] == '"Stripe" official website'


@pytest.mark.asyncio
async def test_serpapi_live_fail(live_settings):
    mock_response = AsyncMock(spec=httpx.Response)
    mock_response.raise_for_status = lambda: None
    mock_response.json.return_value = {
        "organic_results": [
            {"link": "https://northstarfinance.com/"},
        ]
    }

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        adapter = SerpApiAdapter(live_settings)
        result = await adapter.company_signal("ABC Corp", "abcmfg.example")

        assert result["status"] == "FAIL"
        assert result["value"] == "https://northstarfinance.com/"
        assert result["source_url"] is None


@pytest.mark.asyncio
async def test_serpapi_live_unknown(live_settings):
    mock_response = AsyncMock(spec=httpx.Response)
    mock_response.raise_for_status = lambda: None
    mock_response.json.return_value = {
        "organic_results": []
    }

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        adapter = SerpApiAdapter(live_settings)
        result = await adapter.company_signal("Unknown Corp", None)

        assert result["status"] == "UNKNOWN"
        assert result["value"] is None
        assert result["source_url"] is None
        assert result["metadata"]["result_count"] == 0


@pytest.mark.asyncio
async def test_serpapi_live_malformed(live_settings):
    mock_response = AsyncMock(spec=httpx.Response)
    mock_response.raise_for_status = lambda: None
    mock_response.json.return_value = {
        "organic_results": [
            {"not_a_link": "something"},
        ]
    }

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        adapter = SerpApiAdapter(live_settings)
        result = await adapter.company_signal("Stripe", "stripe.com")

        assert result["status"] == "FAIL"
        assert result["value"] is None


@pytest.mark.asyncio
async def test_serpapi_live_missing_key():
    settings = Settings(use_mock_serpapi=False, serpapi_api_key="")
    adapter = SerpApiAdapter(settings)
    
    with pytest.raises(ValueError, match="TRUSTFLOW_SERPAPI_API_KEY is required"):
        await adapter.company_signal("Stripe", "stripe.com")


@pytest.mark.asyncio
async def test_serpapi_live_http_error(live_settings):
    mock_response = AsyncMock(spec=httpx.Response)
    def raise_err():
        raise httpx.HTTPStatusError("403 Forbidden", request=AsyncMock(), response=mock_response)
    mock_response.raise_for_status.side_effect = raise_err

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        adapter = SerpApiAdapter(live_settings)
        with pytest.raises(httpx.HTTPStatusError):
            await adapter.company_signal("Stripe", "stripe.com")
