import asyncio
import json
import httpx
import math
from fastapi import APIRouter, Request, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import re
import models
from dependencies import get_db
from database import SessionLocal as GatewaySessionLocal
from security import decrypt_value

try:
    from gradio_client import Client as GradioClient
except Exception:
    GradioClient = None

_HF_SPACE_ID_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")

router = APIRouter(prefix="/api/gateway", tags=["gateway"])

# ---------------------------------------------------------------------------
# Gradio Client Cache — Singleton per (space_id, token_hash) to prevent OOM.
# Each GradioClient constructor downloads the full API schema and holds it
# in memory.  Creating one per request quickly exhausts the 512 MB limit on
# Render free-tier.  We keep at most _HF_CLIENT_MAX cached clients, each
# for up to _HF_CLIENT_TTL seconds before being recycled.
# ---------------------------------------------------------------------------
import time as _time
import hashlib as _hashlib
import threading as _threading

_hf_client_cache: dict[str, tuple[float, object]] = {}  # key → (created_ts, GradioClient)
_hf_client_lock = _threading.Lock()
_HF_CLIENT_TTL = 600    # 10 minutes
_HF_CLIENT_MAX = 4      # max distinct space+token combos to cache


def _get_or_create_gradio_client(space_id: str, hf_token: str):
    """Return a cached GradioClient, creating one only if missing or expired."""
    token_hash = _hashlib.sha256(hf_token.encode()).hexdigest()[:12]
    cache_key = f"{space_id}::{token_hash}"

    now = _time.time()

    with _hf_client_lock:
        entry = _hf_client_cache.get(cache_key)
        if entry and (now - entry[0] < _HF_CLIENT_TTL):
            return entry[1]

        # Evict expired entries
        expired = [k for k, (ts, _) in _hf_client_cache.items() if now - ts >= _HF_CLIENT_TTL]
        for k in expired:
            try:
                _hf_client_cache[k][1].close()
            except Exception:
                pass
            del _hf_client_cache[k]

        # Evict oldest if at capacity
        while len(_hf_client_cache) >= _HF_CLIENT_MAX:
            oldest_key = min(_hf_client_cache, key=lambda k: _hf_client_cache[k][0])
            try:
                _hf_client_cache[oldest_key][1].close()
            except Exception:
                pass
            del _hf_client_cache[oldest_key]

    # Create OUTSIDE the lock to avoid blocking other requests
    if "hf_token" in GradioClient.__init__.__code__.co_varnames:
        client = GradioClient(space_id, hf_token=hf_token)
    else:
        client = GradioClient(space_id, token=hf_token)

    with _hf_client_lock:
        _hf_client_cache[cache_key] = (now, client)

    return client


_HF_TEXT_IN_KEYS = {"inputs", "input", "text", "prompt", "query"}
_HF_TEXT_OUT_KEYS = {"generated_text", "summary_text", "text", "answer", "output", "translation_text"}


def _estimate_tokens_from_text(text: str | None) -> int:
    """
    Heuristic token estimation for providers that don't return usage metadata.
    ~4 characters per token (roughly), clamped to >= 1 for non-empty strings.
    """
    if not text:
        return 0
    t = math.ceil(len(text) / 4)
    return max(1, int(t))


def _collect_strings(obj, max_items: int = 16) -> list[str]:
    out: list[str] = []

    def _walk(x):
        nonlocal out
        if len(out) >= max_items:
            return
        if isinstance(x, str):
            s = x.strip()
            if s:
                out.append(s)
            return
        if isinstance(x, dict):
            for v in x.values():
                _walk(v)
                if len(out) >= max_items:
                    return
            return
        if isinstance(x, list):
            for v in x:
                _walk(v)
                if len(out) >= max_items:
                    return
            return

    _walk(obj)
    return out


def _collect_text_fields(obj, allowed_keys: set[str], max_items: int = 16) -> list[str]:
    out: list[str] = []

    def _walk(x):
        nonlocal out
        if len(out) >= max_items:
            return
        if isinstance(x, dict):
            for k, v in x.items():
                if len(out) >= max_items:
                    return
                if isinstance(k, str) and k in allowed_keys:
                    for s in _collect_strings(v, max_items=max_items - len(out)):
                        if len(out) >= max_items:
                            return
                        out.append(s)
                else:
                    _walk(v)
            return
        if isinstance(x, list):
            for v in x:
                _walk(v)
                if len(out) >= max_items:
                    return
            return

    _walk(obj)
    return out


def _safe_json_loads(data: bytes) -> object | None:
    try:
        return json.loads(data)
    except Exception:
        try:
            return json.loads(data.decode("utf-8", errors="ignore"))
        except Exception:
            return None


def _gemini_model_from_payload(payload: object, default: str) -> str:
    if not isinstance(payload, dict):
        return default
    model_name = str(payload.get("model") or default)
    if model_name.startswith("models/"):
        model_name = model_name[len("models/"):]
    return model_name


def _gemini_text_part(value) -> dict:
    if isinstance(value, list):
        text = "\n".join(str(item.get("text", item)) if isinstance(item, dict) else str(item) for item in value)
    elif isinstance(value, dict):
        text = str(value.get("text") or value.get("content") or json.dumps(value))
    else:
        text = str(value or "")
    return {"text": text}


def _normalize_gemini_body(body: bytes, *, embedding: bool) -> tuple[bytes, str | None]:
    payload = _safe_json_loads(body) if body else None
    if not isinstance(payload, dict):
        return body, None

    model_name = _gemini_model_from_payload(
        payload,
        "gemini-embedding-001" if embedding else "gemini-2.5-flash-lite",
    )
    outbound = dict(payload)
    outbound.pop("model", None)

    if embedding:
        if "content" not in outbound and "contents" in outbound:
            contents = outbound.pop("contents")
            if isinstance(contents, list) and contents:
                outbound["content"] = contents[0]
            else:
                outbound["content"] = {"parts": [_gemini_text_part(contents)]}
        elif "content" not in outbound and "messages" in outbound:
            messages = outbound.pop("messages")
            text = "\n".join(
                str(message.get("content", "")) for message in messages if isinstance(message, dict)
            )
            outbound["content"] = {"parts": [{"text": text}]}
        return json.dumps(outbound).encode("utf-8"), model_name

    if "contents" not in outbound and "messages" in outbound:
        messages = outbound.pop("messages")
        contents = []
        for message in messages if isinstance(messages, list) else []:
            if not isinstance(message, dict):
                continue
            role = "model" if message.get("role") == "assistant" else "user"
            contents.append({"role": role, "parts": [_gemini_text_part(message.get("content"))]})
        outbound["contents"] = contents or [{"role": "user", "parts": [{"text": ""}]}]
    elif "contents" not in outbound and "content" in outbound:
        content = outbound.pop("content")
        if isinstance(content, dict) and isinstance(content.get("parts"), list):
            outbound["contents"] = [{"role": "user", "parts": content["parts"]}]
        else:
            outbound["contents"] = [{"role": "user", "parts": [_gemini_text_part(content)]}]

    return json.dumps(outbound).encode("utf-8"), model_name


def _estimate_huggingface_tokens(request_body: bytes, response_body: bytes) -> int:
    req_json = _safe_json_loads(request_body) if request_body else None
    res_json = _safe_json_loads(response_body) if response_body else None

    in_texts = _collect_text_fields(req_json, _HF_TEXT_IN_KEYS) if req_json is not None else []
    out_texts = _collect_text_fields(res_json, _HF_TEXT_OUT_KEYS) if res_json is not None else []

    # Fallback: if we couldn't find known fields, just grab a couple of strings.
    if not in_texts and req_json is not None:
        in_texts = _collect_strings(req_json, max_items=4)
    if not out_texts and res_json is not None:
        out_texts = _collect_strings(res_json, max_items=4)

    input_text = " ".join(in_texts) if in_texts else ""
    output_text = " ".join(out_texts) if out_texts else ""
    return _estimate_tokens_from_text(input_text) + _estimate_tokens_from_text(output_text)


def log_api_usage(db: Session, api_key_id: int, tokens_used: int, status_code: int = 200, is_error: bool = False, api_key_name: str = None, error_message: str = None):
    log = models.ApiUsageLog(
        api_key_id=api_key_id,
        api_key_name=api_key_name,
        tokens_used=tokens_used,
        status_code=status_code,
        is_error=is_error,
        error_message=error_message,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()

def _hash_key(key: str) -> str:
    import hashlib
    return hashlib.sha256(key.encode("utf-8")).hexdigest()

def verify_gateway_auth(request: Request, db: Session = Depends(get_db)) -> int:
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
            and _is_usable_key(m.api_key, provider)
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

def _is_usable_key(api_key: models.ApiKey, provider: str) -> bool:
    status = (api_key.status or "").lower()
    if "active" in status:
        return True
    # Migration bridge: OpenRouter keys saved before validator support were
    # marked Unknown Provider, which made the gateway skip otherwise valid keys.
    return provider == "openrouter" and status in {"unknown", "unknown provider"}

def get_active_key(db: Session, user_id: int, provider: str, category: str = None) -> models.ApiKey:
    # First try group-based selection
    key = _pick_from_group(db, user_id, provider, category)
    if key:
        return key
    
    # Fallback to direct key selection
    query = db.query(models.ApiKey).filter(
        models.ApiKey.user_id == user_id,
        models.ApiKey.provider == provider,
    )
    if category:
        query = query.filter(models.ApiKey.category == category)
    
    import random
    keys = [k for k in query.all() if _is_usable_key(k, provider)]
    key = random.choice(keys) if keys else None
    if not key and category:
        # Fallback to any active key for this provider
        keys = [
            k for k in db.query(models.ApiKey).filter(
            models.ApiKey.user_id == user_id,
            models.ApiKey.provider == provider,
            ).all()
            if _is_usable_key(k, provider)
        ]
        key = random.choice(keys) if keys else None
    return key


def _active_key_material(user_id: int, provider: str, category: str = None) -> dict | None:
    db = GatewaySessionLocal()
    try:
        api_key = get_active_key(db, user_id, provider, category)
        if not api_key:
            return None
        return {
            "id": api_key.id,
            "name": api_key.name,
            "plaintext": decrypt_value(api_key.encrypted_key),
        }
    finally:
        db.close()


def _log_api_usage_safe(
    api_key_id: int,
    tokens_used: int,
    status_code: int,
    is_error: bool,
    api_key_name: str = None,
    error_message: str = None,
) -> None:
    db = GatewaySessionLocal()
    try:
        log_api_usage(db, api_key_id, tokens_used, status_code, is_error, api_key_name, error_message)
    except Exception as exc:
        print(f"Gateway usage log failed: {exc}")
    finally:
        db.close()

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
    key_material = await asyncio.to_thread(_active_key_material, user_id, provider, category)
    if not key_material:
        raise HTTPException(status_code=404, detail=f"No active API key found for provider: {provider}")

    plaintext_key = key_material["plaintext"]
    
    headers = _filtered_forward_headers(request)
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

    if provider == "openrouter":
        headers.setdefault("HTTP-Referer", "https://news-intel.local")
        headers.setdefault("X-Title", "News-Intel via Cloud Command")

    body = await request.body()

    # ── Gemini smart-route ──
    # When the caller doesn't supply a full Gemini API path (e.g. POSTs to
    # /api/gateway/gemini with {"contents": [...]}), auto-construct the
    # correct v1beta/models/{model}:generateContent URL.
    # Default model: gemini-2.5-flash-lite (free tier, confirmed working).
    # Callers can override by including a top-level "model" field in the
    # JSON body, e.g. {"model": "gemini-2.5-flash", "contents": [...]}.
    if provider == "gemini":
        _GEMINI_DEFAULT_MODEL = "gemini-2.5-flash-lite"
        _is_embedding_request = (
            "embedContent" in path
            or path.strip("/").lower() in {"embeddings", "embedding", "embed"}
        )
        body, body_model = _normalize_gemini_body(body, embedding=_is_embedding_request)
        _needs_auto_route = (
            not path
            or not any(seg in path for seg in ("models/", ":generateContent", ":streamGenerateContent"))
        )
        if _needs_auto_route or _is_embedding_request:
            model_name = body_model or _GEMINI_DEFAULT_MODEL
            action = "embedContent" if _is_embedding_request else (
                "streamGenerateContent" if request.headers.get("accept", "").startswith("text/event-stream") else "generateContent"
            )
            # Gemini embedding REST support is advertised through v1beta
            # by ListModels/embedContent for the Gemini API.
            api_version = "v1beta"
            target_url = f"{base_url}/{api_version}/models/{model_name}:{action}"
        else:
            # Caller provided a full path — ensure it uses v1beta not deprecated v1
            if path.startswith("v1/"):
                path = "v1beta/" + path[3:]
            target_url = f"{base_url}/{path}"
    elif path:
        target_url = f"{base_url}/{path}"
    else:
        target_url = f"{base_url}/"
    
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

        # Hugging Face inference responses typically don't include usage metadata.
        if tracked_tokens == 0 and provider == "huggingface":
            tracked_tokens = _estimate_huggingface_tokens(body, resp_bytes)

        error_message = None
        if resp.status_code >= 400:
            try:
                error_message = resp_bytes.decode('utf-8', errors='ignore')
                if len(error_message) > 500:
                    error_message = error_message[:500] + "..."
            except Exception:
                pass
            
        background_tasks.add_task(
            _log_api_usage_safe,
            key_material["id"],
            tracked_tokens,
            resp.status_code,
            resp.status_code >= 400,
            key_material["name"],
            error_message,
        )
            
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
                        match = re.search(r'"totalTokenCount":\s*(\d+)', chunk_str)
                        if match:
                            tracked_tokens = max(tracked_tokens, int(match.group(1)))
                    elif "usage" in chunk_str:
                        match = re.search(r'"total_tokens":\s*(\d+)', chunk_str)
                        if match:
                            tracked_tokens = max(tracked_tokens, int(match.group(1)))
                except:
                    pass
                yield chunk
        finally:
            await client.aclose()
            
            error_message = None
            if resp.status_code >= 400:
                error_message = f"Stream failed with status {resp.status_code}"
            await asyncio.to_thread(
                _log_api_usage_safe,
                key_material["id"],
                tracked_tokens,
                resp.status_code,
                resp.status_code >= 400,
                key_material["name"],
                error_message,
            )

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
    key_material = await asyncio.to_thread(_active_key_material, user_id, "huggingface", category)
    if not key_material:
        raise HTTPException(status_code=404, detail="No active API key found for provider: huggingface")

    plaintext_key = key_material["plaintext"]

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    input_text = payload.get("inputs") or payload.get("text") or payload.get("input")
    if input_text is None and isinstance(payload.get("data"), list) and payload["data"]:
        input_text = payload["data"][0]

    if input_text is None:
        raise HTTPException(status_code=400, detail="Missing input. Provide JSON body with \"inputs\".")

    api_name = f"/{endpoint.lstrip('/')}"

    def _call_space():
        client = _get_or_create_gradio_client(space_id, plaintext_key)
        return client.predict(input_text, api_name=api_name)

    try:
        result_raw = await asyncio.to_thread(_call_space)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Space proxy error: {str(e)}")

    estimated_tokens = 0
    try:
        out_text = result_raw if isinstance(result_raw, str) else json.dumps(result_raw)
        estimated_tokens = _estimate_tokens_from_text(input_text) + _estimate_tokens_from_text(out_text)
    except Exception:
        estimated_tokens = _estimate_tokens_from_text(input_text)

    error_message = None
    if isinstance(result_raw, Exception):
        error_message = str(result_raw)

    background_tasks.add_task(
        _log_api_usage_safe,
        key_material["id"],
        estimated_tokens,
        200 if not error_message else 500,
        bool(error_message),
        key_material["name"],
        error_message,
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
