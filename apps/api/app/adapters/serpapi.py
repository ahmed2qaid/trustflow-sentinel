from urllib.parse import urlparse

import httpx

from ..config import Settings, get_settings


class SerpApiAdapter:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    async def company_signal(
        self,
        company_name: str,
        submitted_domain: str | None,
        *,
        location: str = "New York, New York, United States",
    ) -> dict:
        if self.settings.use_mock_serpapi or not self.settings.serpapi_api_key:
            return self._mock_signal(company_name, submitted_domain)

        params = {
            "engine": "google",
            "q": f'"{company_name}" official website',
            "location": location,
            "gl": "us",
            "hl": "en",
            "api_key": self.settings.serpapi_api_key,
        }
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.get(self.settings.serpapi_url, params=params)
        response.raise_for_status()
        payload = response.json()
        submitted_host = self._host(submitted_domain)

        organic = payload.get("organic_results", [])[:8]
        matching = []
        for result in organic:
            link = result.get("link")
            host = self._host(link)
            if submitted_host and host and self._same_domain(submitted_host, host):
                matching.append(link)

        return {
            "status": "PASS" if matching else "FAIL" if submitted_domain else "UNKNOWN",
            "value": matching[0] if matching else organic[0].get("link") if organic else None,
            "query": params["q"],
            "source_url": matching[0] if matching else None,
            "metadata": {"matched_results": matching, "result_count": len(organic)},
        }

    @staticmethod
    def _host(url: str | None) -> str | None:
        if not url:
            return None
        candidate = url if "://" in url else f"https://{url}"
        host = urlparse(candidate).hostname
        return host.removeprefix("www.") if host else None

    @staticmethod
    def _same_domain(a: str, b: str) -> bool:
        return a == b or a.endswith(f".{b}") or b.endswith(f".{a}")

    @staticmethod
    def _mock_signal(company_name: str, submitted_domain: str | None) -> dict:
        bad = submitted_domain and ("globalpay" in submitted_domain or "payments" in submitted_domain)
        return {
            "status": "FAIL" if bad else "PASS",
            "value": "https://northstarfinance.com" if "NorthStar" in company_name else "https://abcmfg.example",
            "query": f'"{company_name}" official website',
            "source_url": None,
            "metadata": {"mode": "mock", "submitted_domain": submitted_domain},
        }
