import asyncio
import json
import httpx
from fastapi import APIRouter, Request, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import re
import models
from dependencies import get_db
from security import decrypt_value

try:
    from gradio_client import Client as GradioClient
except Exception:
    GradioClient = None

_HF_SPACE_ID_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")

router = APIRouter(prefix="/api/gateway", tags=["gateway"])

def log_api_usage(db: Session, api_key_id: int, tokens_used: int, status_code: int = 200, is_error: bool = False, api_key_name: str = None):
    log = models.ApiUsageLog(
        api_key_id=api_key_id, 
        api_key_name=api_key_name,
        tokens_used=tokens_used, 
        status_code=status_code,
        is_error=is_error,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()

def _hash_key(key: str) -> str:
    import hashlib
    return hashlib.sha256(key.encode("utf-8")).hexdigest()

async def verify_gateway_auth(request: Request, db: Session = Depends(get_db)) -> int:
    auth_header = request.headers.get("Authorization")
    custom_header = request.headers.get("X-Gateway-Secret")
    
    secret = None
    if auth_header and auth_header.startswith("Bearer "):
        secret = auth_header.split(" ")[1]
    elif custom_header:
        secret = custom_header
        
    if not secret:
        raise HTTPException(status_code=401, detail="Missing Gateway Authentication")
        
    key_hash = _hash_key(secret)
    gateway_key = db.query(models.GatewayApiKey).filter(models.GatewayApiKey.key_hash == key_hash).first()
    
    if not gateway_key:
        raise HTTPException(status_code=401, detail="Invalid Gateway API Key")
        
    gateway_key.last_used_at = datetime.now(timezone.utc)
    db.commit()
    
    return gateway_key.user_id

def _pick_from_group(db: Session, user_id: int, provider: str, category: str = None) -> models.ApiKey:
    """Try to find and pick a key using key groups with strategy-based selection."""
    import random as rng
    
    # Find groups that have matching keys
    groups = db.query(models.ApiKeyGroup).filter(models.ApiKeyGroup.user_id == user_id).all()
    for group in groups:
        enabled_members = [
            m for m in group.members 
            if m.is_enabled 
            and m.api_key 
            and m.api_key.provider == provider
            and "active" in m.api_key.status.lower()
        ]
        if category:
            cat_members = [m for m in enabled_members if m.api_key.category == category]
            if cat_members:
                enabled_members = cat_members
        
        if not enabled_members:
            continue
            
        if group.strategy == "fallback":
            # Pick highest priority (lowest number)
            sorted_members = sorted(enabled_members, key=lambda m: m.priority)
            return sorted_members[0].api_key
        elif group.strategy == "round-robin":
            # Round-robin based on total usage count (least used first)
            from sqlalchemy import func
            member_usage = []
            for m in enabled_members:
                count = db.query(func.count(models.ApiUsageLog.id)).filter(
                    models.ApiUsageLog.api_key_id == m.api_key_id
                ).scalar() or 0
                member_usage.append((m, count))
            member_usage.sort(key=lambda x: x[1])
            return member_usage[0][0].api_key
        else:  # random
            return rng.choice(enabled_members).api_key
    
    return None

def get_active_key(db: Session, user_id: int, provider: str, category: str = None) -> models.ApiKey:
    # First try group-based selection
    key = _pick_from_group(db, user_id, provider, category)
    if key:
        return key
    
    # Fallback to direct key selection
    query = db.query(models.ApiKey).filter(
        models.ApiKey.user_id == user_id,
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
            models.ApiKey.user_id == user_id,
            models.ApiKey.provider == provider,
            models.ApiKey.status.ilike("%active%")
        ).all()
        key = random.choice(keys) if keys else None
    return key

def _filtered_forward_headers(request: Request) -> dict:
    # Strip hop-by-hop headers + gateway auth headers so we don't leak them upstream.
    blocked = {
        "host",
        "connection",
        "content-length",
        "authorization",
        "x-gateway-secret",
        "x-project-category",
    }
    return {k: v for k, v in request.headers.items() if k.lower() not in blocked}

async def _proxy_gateway_request(
    provider: str,
    path: str,
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: int = Depends(verify_gateway_auth),
    db: Session = Depends(get_db)
):
    provider = provider.lower()
    
    category = request.headers.get("X-Project-Category")
    api_key = get_active_key(db, user_id, provider, category)
    if not api_key:
        raise HTTPException(status_code=404, detail=f"No active API key found for provider: {provider}")

    plaintext_key = decrypt_value(api_key.encrypted_key)
    
    base_url = ""
    headers = _filtered_forward_headers(request)
    
    query_params = dict(request.query_params)
    
    # â”€â”€ UNIVERSAL PROVIDER MAPPING â”€â”€
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
        "huggingface": "https://router.huggingface.co/hf-inference",
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

    if path:
        target_url = f"{base_url}/{path}"
    else:
        target_url = f"{base_url}/"
    
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
            
        background_tasks.add_task(log_api_usage, db, api_key.id, tracked_tokens, resp.status_code, resp.status_code >= 400, api_key_name=api_key.name)
            
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
                log_api_usage(db_session, api_key.id, tracked_tokens, resp.status_code, resp.status_code >= 400, api_key_name=api_key.name)
            finally:
                db_session.close()

    resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in ("content-length", "content-encoding")}
    return StreamingResponse(stream_generator(), status_code=resp.status_code, headers=resp_headers)


@router.api_route("/huggingface/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy_huggingface(
    path: str,
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: int = Depends(verify_gateway_auth),
    db: Session = Depends(get_db),
):
    return await _proxy_gateway_request("huggingface", path, request, background_tasks, user_id, db)


@router.post("/huggingface-space/{owner}/{space}/{endpoint}")
async def proxy_huggingface_space(
    owner: str,
    space: str,
    endpoint: str,
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: int = Depends(verify_gateway_auth),
    db: Session = Depends(get_db),
):
    """
    Proxy a call to a Hugging Face Space Gradio endpoint using the gateway secret only.

    Client calls:
      POST /api/gateway/huggingface-space/{owner}/{space}/{endpoint}

    Body:
      {"inputs": "..."}  (News-Intel style)
    """
    if GradioClient is None:
        raise HTTPException(
            status_code=500,
            detail="gradio-client is not installed on the server. Add \"gradio-client\" to backend/requirements.txt and redeploy.",
        )

    space_id = f"{owner}/{space}"
    if not _HF_SPACE_ID_RE.match(space_id):
        raise HTTPException(status_code=400, detail="Invalid space id format. Expected: <owner>/<space>.")

    category = request.headers.get("X-Project-Category")
    api_key = get_active_key(db, user_id, "huggingface", category)
    if not api_key:
        raise HTTPException(status_code=404, detail="No active API key found for provider: huggingface")

    plaintext_key = decrypt_value(api_key.encrypted_key)

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    input_text = payload.get("inputs") or payload.get("text") or payload.get("input")
    if input_text is None and isinstance(payload.get("data"), list) and payload["data"]:
        input_text = payload["data"][0]

    if input_text is None:
        raise HTTPException(status_code=400, detail="Missing input. Provide JSON body with \"inputs\".")

    api_name = f"/{endpoint.lstrip(\"/\")}"

    def _call_space():
        # Support both new and old gradio_client constructor param names.
        if "hf_token" in GradioClient.__init__.__code__.co_varnames:
            client = GradioClient(space_id, hf_token=plaintext_key)
        else:
            client = GradioClient(space_id, token=plaintext_key)
        return client.predict(input_text, api_name=api_name)

    try:
        result_raw = await asyncio.to_thread(_call_space)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Space proxy error: {str(e)}")

    background_tasks.add_task(
        log_api_usage,
        db,
        api_key.id,
        0,
        200,
        False,
        api_key_name=api_key.name,
    )

    if isinstance(result_raw, (dict, list)):
        return Response(content=json.dumps(result_raw), media_type="application/json")
    if isinstance(result_raw, str):
        media = "application/json" if result_raw.lstrip().startswith(("{", "[")) else "text/plain"
        return Response(content=result_raw, media_type=media)
    return Response(content=json.dumps({"result": result_raw}), media_type="application/json")

@router.api_route("/{provider}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy_gateway_root(
    provider: str,
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: int = Depends(verify_gateway_auth),
    db: Session = Depends(get_db),
):
    return await _proxy_gateway_request(provider, "", request, background_tasks, user_id, db)


@router.api_route("/{provider}/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy_gateway(
    provider: str,
    path: str,
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: int = Depends(verify_gateway_auth),
    db: Session = Depends(get_db),
):
    return await _proxy_gateway_request(provider, path, request, background_tasks, user_id, db)
