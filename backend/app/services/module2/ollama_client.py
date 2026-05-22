import httpx

from app.core.config import settings


class OllamaClient:
    def __init__(self):
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.model = settings.ollama_model
        self.fallback_model = getattr(settings, "ollama_fallback_model", None)

        timeout_seconds = float(getattr(settings, "ollama_timeout_seconds", 300) or 300)
        self.timeout = httpx.Timeout(
            connect=10.0,
            read=max(timeout_seconds, 300.0),
            write=30.0,
            pool=30.0,
        )

    async def _generate_once(self, model: str, prompt: str) -> str:
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

        text = data.get("response", "").strip()
        if not text:
            raise ValueError(f"Empty response field. data={data}")

        return text

    async def generate_text(self, prompt: str) -> str:
        try:
            return await self._generate_once(self.model, prompt)
        except Exception:
            if self.fallback_model and self.fallback_model != self.model:
                return await self._generate_once(self.fallback_model, prompt)
            raise