import json

import httpx

from ..config import Settings, get_settings


class LLMAdapter:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    async def explain(self, decision: str, reason_codes: list[str], checks: list[dict]) -> str:
        if self.settings.use_mock_llm:
            return self._fallback(decision, reason_codes)

        prompt = (
            "You are a financial controls assistant. Explain the decision using only the supplied "
            "policy checks. Do not invent legal conclusions. Be concise and auditable.\n"
            f"Decision: {decision}\nReason codes: {reason_codes}\nChecks: {json.dumps(checks)}"
        )
        payload = {
            "model": self.settings.ollama_model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1},
        }
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(f"{self.settings.ollama_url}/api/generate", json=payload)
            response.raise_for_status()
            return response.json().get("response", "") or self._fallback(decision, reason_codes)
        except httpx.HTTPError:
            return self._fallback(decision, reason_codes)

    @staticmethod
    def _fallback(decision: str, reason_codes: list[str]) -> str:
        if decision == "ALLOW":
            return "No high-risk payment change was detected and the available evidence is consistent."
        if decision == "BLOCK":
            return "A critical policy check failed. The requested payment change must not be approved without corrected evidence."
        readable = ", ".join(code.replace("_", " ").lower() for code in reason_codes[:4])
        return f"The request requires human review because it contains a sensitive change supported by checks including: {readable}."
