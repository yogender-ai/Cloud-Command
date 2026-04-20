import json
import httpx
from fastapi import APIRouter, Request, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import models
from dependencies import get_db
from security import decrypt_value
from config import settings

router = APIRouter(prefix="/api/gateway", tags=["gateway"])

def log_api_usage(db: Session, api_key_id: int, tokens_used: int, status_code: int = 200, is_error: bool = False):
    log = models.ApiUsageLog(
        api_key_id=api_key_id, 
        tokens_used=tokens_used, 
        status_code=status_code,
        is_error=is_error,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()

async def verify_gateway_auth(request: Request):
    auth_header = request.headers.get("Authorization")
    custom_header = request.headers.get("X-Gateway-Secret")
    
    secret = None
    if auth_header and auth_header.startswith("Bearer "):
        secret = auth_header.split(" ")[1]
    elif custom_header:
        secret = custom_header
        
    if secret != settings.GATEWAY_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized Gateway Access")

def get_active_key(db: Session, provider: str, category: str = None) -> models.ApiKey:
    query = db.query(models.ApiKey).filter(
        models.ApiKey.provider == provider,
        models.ApiKey.status.ilike("%active%")
    )
    if category:
        query = query.filter(models.ApiKey.category == category)
    
    import random
    keys = query.all()
    key = random.choice(keys) if keys else None
    if not key and category:
        # Fallback to any active key for this provider
        keys = db.query(models.ApiKey).filter(
            models.ApiKey.provider == provider,
            models.ApiKey.status.ilike("%active%")
        ).all()
        key = random.choice(keys) if keys else None
    return key

@router.api_route("/{provider}/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_gateway(
    provider: str,
    path: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    await verify_gateway_auth(request)
    provider = provider.lower()
    
    category = request.headers.get("X-Project-Category")
    api_key = get_active_key(db, provider, category)
    if not api_key:
        raise HTTPException(status_code=404, detail=f"No active API key found for provider: {provider}")

    plaintext_key = decrypt_value(api_key.encrypted_key)
    
    base_url = ""
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("authorization", None) 
    
    query_params = dict(request.query_params)
    
    # ── UNIVERSAL PROVIDER MAPPING ──
    provider_urls = {
        "gemini": "https://generativelanguage.googleapis.com",
        "openai": "https://api.openai.com",
        "anthropic": "https://api.anthropic.com",
        "deepseek": "https://api.deepseek.com",
        "groq": "https://api.groq.com/openai",
        "mistral": "https://api.mistral.ai",
        "xai": "https://api.x.ai",
        "grok": "https://api.x.ai",
        "cohere": "https://api.cohere.com",
        "huggingface": "https://api-inference.huggingface.co",
        "openrouter": "https://openrouter.ai/api",
    }
    
    if provider not in provider_urls:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")
        
    base_url = provider_urls[provider]
    
    # Configure Authentication per provider
    if provider == "gemini":
        query_params["key"] = plaintext_key
    elif provider == "anthropic":
        headers["x-api-key"] = plaintext_key
    else:
        # OpenAI, DeepSeek, Groq, Mistral, xAI, Cohere, HuggingFace, OpenRouter 
        # all use standard Bearer token format natively.
        headers["Authorization"] = f"Bearer {plaintext_key}"

    target_url = f"{base_url}/{path}"
    
    body = await request.body()
    
    client = httpx.AsyncClient(timeout=60.0)
    
    req = client.build_request(
        method=request.method,
        url=target_url,
        params=query_params,
        headers=headers,
        content=body
    )
    
    try:
        resp = await client.send(req, stream=True)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Proxy error: {str(e)}")
    
    content_type = resp.headers.get("content-type", "")
    is_stream = "text/event-stream" in content_type or "application/x-ndjson" in content_type

    if not is_stream:
        resp_bytes = await resp.aread()
        await client.aclose()
        tracked_tokens = 0
        try:
            if "application/json" in content_type:
                data = json.loads(resp_bytes)
                # Standard OpenAI compatibility shape (Groq, DeepSeek, Mistral, xAI, OpenRouter use this)
                if "usage" in data:
                    if "total_tokens" in data["usage"]:
                        tracked_tokens = data["usage"]["total_tokens"]
                    elif "input_tokens" in data["usage"]:
                        # Anthropic uses input_tokens + output_tokens inside usage
                        tracked_tokens = data["usage"].get("input_tokens", 0) + data["usage"].get("output_tokens", 0)
                elif provider == "gemini" and "usageMetadata" in data:
                    tracked_tokens = data["usageMetadata"].get("totalTokenCount", 0)
        except Exception:
            pass
            
        background_tasks.add_task(log_api_usage, db, api_key.id, tracked_tokens, resp.status_code, resp.status_code >= 400)
            
        filtered_headers = {k: v for k, v in resp.headers.items() if k.lower() not in ("content-length", "content-encoding")}
        return Response(content=resp_bytes, status_code=resp.status_code, headers=filtered_headers)

    # Streaming block
    async def stream_generator():
        tracked_tokens = 0
        try:
            async for chunk in resp.aiter_bytes():
                try:
                    chunk_str = chunk.decode('utf-8', errors='ignore')
                    if provider == "gemini" and "usageMetadata" in chunk_str:
                        import re
                        match = re.search(r'"totalTokenCount":\s*(\d+)', chunk_str)
                        if match:
                            tracked_tokens = max(tracked_tokens, int(match.group(1)))
                    elif "usage" in chunk_str:
                        import re
                        match = re.search(r'"total_tokens":\s*(\d+)', chunk_str)
                        if match:
                            tracked_tokens = max(tracked_tokens, int(match.group(1)))
                except:
                    pass
                yield chunk
        finally:
            await client.aclose()
            
            from database import SessionLocal as DBSession
            db_session = DBSession()
            try:
                log_api_usage(db_session, api_key.id, tracked_tokens, resp.status_code, resp.status_code >= 400)
            finally:
                db_session.close()

    resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in ("content-length", "content-encoding")}
    return StreamingResponse(stream_generator(), status_code=resp.status_code, headers=resp_headers)
