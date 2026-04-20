"""
API Key Validator — checks keys against real provider endpoints.
Ported from the original Python/FastAPI API monitor.
"""

import httpx


async def check_api_key_validity(provider: str, key: str) -> str:
    """
    Validate an API key against the provider's API.
    Returns a status string: Active, Invalid, Suspended, etc.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            p = provider.lower()

            if p == "openai":
                r = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                )
                if r.status_code == 200:
                    return "Active"
                elif r.status_code == 401:
                    return "Invalid"
                elif r.status_code == 429:
                    return "Rate Limited"
                return f"Error ({r.status_code})"

            elif p == "anthropic":
                r = await client.get(
                    "https://api.anthropic.com/v1/models",
                    headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
                )
                if r.status_code == 200:
                    return "Active"
                elif r.status_code == 401:
                    return "Invalid"
                elif r.status_code == 403:
                    return "Suspended"
                return f"Error ({r.status_code})"

            elif p == "huggingface":
                r = await client.get(
                    "https://huggingface.co/api/whoami-v2",
                    headers={"Authorization": f"Bearer {key}"},
                )
                if r.status_code == 200:
                    return "Active"
                elif r.status_code == 401:
                    return "Invalid"
                return f"Error ({r.status_code})"

            elif p == "gemini":
                r = await client.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
                )
                if r.status_code == 200:
                    return "Active"
                elif r.status_code in (400, 403):
                    return "Invalid"
                return f"Error ({r.status_code})"

            elif p == "deepseek":
                r = await client.get(
                    "https://api.deepseek.com/models",
                    headers={"Authorization": f"Bearer {key}"},
                )
                if r.status_code == 200:
                    return "Active"
                elif r.status_code == 401:
                    return "Invalid"
                elif r.status_code == 402:
                    return "Insufficient Balance"
                return f"Error ({r.status_code})"

            elif p == "groq":
                r = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                )
                if r.status_code == 200:
                    return "Active"
                elif r.status_code == 401:
                    return "Invalid"
                return f"Error ({r.status_code})"

            elif p == "mistral":
                r = await client.get(
                    "https://api.mistral.ai/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                )
                if r.status_code == 200:
                    return "Active"
                elif r.status_code == 401:
                    return "Invalid"
                return f"Error ({r.status_code})"

            elif p in ("xai", "grok"):
                r = await client.get(
                    "https://api.x.ai/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                )
                if r.status_code == 200:
                    return "Active"
                elif r.status_code == 401:
                    return "Invalid"
                return f"Error ({r.status_code})"

            elif p == "cohere":
                r = await client.get(
                    "https://api.cohere.com/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                )
                if r.status_code == 200:
                    return "Active"
                elif r.status_code == 401:
                    return "Invalid"
                return f"Error ({r.status_code})"

            else:
                return "Unknown Provider"

    except httpx.TimeoutException:
        return "Timeout"
    except Exception as e:
        return f"Error: {str(e)[:50]}"
