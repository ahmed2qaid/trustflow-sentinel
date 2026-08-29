from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.adapters.nutrient import NutrientAdapter
from app.config import Settings


@pytest.fixture
def live_settings():
    return Settings(
        use_mock_nutrient=False,
        nutrient_api_key="test_key_123",
        nutrient_api_url="https://api.nutrient.io/extraction/extract",
    )


@pytest.mark.asyncio
async def test_nutrient_live_success(live_settings, tmp_path):
    pdf_path = tmp_path / "test.pdf"
    pdf_path.write_bytes(b"%PDF-1.4")

    mock_response = AsyncMock(spec=httpx.Response)
    mock_response.raise_for_status = lambda: None
    mock_response.json.return_value = {
        "output": {
            "data": {"assignor": "ABC Inc."},
            "metadata": {"assignor": {"confidence": 0.98, "bbox": {}}},
        }
    }

    with patch("httpx.AsyncClient.post", return_value=mock_response) as mock_post:
        adapter = NutrientAdapter(live_settings)
        result = await adapter.extract(str(pdf_path), "assignment")

        assert result["provider"] == "nutrient"
        assert result["mode"] == "live"
        assert result["data"] == {"assignor": "ABC Inc."}
        assert result["metadata"] == {"assignor": {"confidence": 0.98, "bbox": {}}}
        
        # Verify call arguments
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert kwargs["headers"]["Authorization"] == "Bearer test_key_123"
        assert "instructions" in kwargs["data"]


@pytest.mark.asyncio
async def test_nutrient_live_missing_data(live_settings, tmp_path):
    pdf_path = tmp_path / "test.pdf"
    pdf_path.write_bytes(b"%PDF-1.4")

    mock_response = AsyncMock(spec=httpx.Response)
    mock_response.raise_for_status = lambda: None
    mock_response.json.return_value = {}  # Missing "output" completely

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        adapter = NutrientAdapter(live_settings)
        result = await adapter.extract(str(pdf_path), "assignment")

        assert result["data"] == {}
        assert result["metadata"] == {}


@pytest.mark.asyncio
async def test_nutrient_live_http_error(live_settings, tmp_path):
    pdf_path = tmp_path / "test.pdf"
    pdf_path.write_bytes(b"%PDF-1.4")

    mock_response = AsyncMock(spec=httpx.Response)
    def raise_err():
        raise httpx.HTTPStatusError("400 Bad Request", request=AsyncMock(), response=mock_response)
    mock_response.raise_for_status.side_effect = raise_err

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        adapter = NutrientAdapter(live_settings)
        with pytest.raises(httpx.HTTPStatusError):
            await adapter.extract(str(pdf_path), "assignment")


@pytest.mark.asyncio
async def test_nutrient_missing_api_key(tmp_path):
    pdf_path = tmp_path / "test.pdf"
    pdf_path.write_bytes(b"%PDF-1.4")

    settings = Settings(
        use_mock_nutrient=False,
        nutrient_api_key="",  # Empty key
    )
    adapter = NutrientAdapter(settings)
    
    with pytest.raises(ValueError, match="TRUSTFLOW_NUTRIENT_API_KEY is required"):
        await adapter.extract(str(pdf_path), "assignment")
