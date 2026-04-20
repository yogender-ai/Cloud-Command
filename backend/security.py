"""
Security module — Argon2id password hashing, Fernet AES encryption, JWT tokens.
"""

from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from argon2 import PasswordHasher, Type
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from cryptography.fernet import Fernet, InvalidToken

from config import settings

# ──────────────────────────────────────
# ARGON2ID PASSWORD HASHING
# ──────────────────────────────────────
# Argon2id is the winner of the Password Hashing Competition
# and is recommended over bcrypt/scrypt for new systems.
_ph = PasswordHasher(
    time_cost=3,       # Number of iterations
    memory_cost=65536,  # 64 MB memory usage
    parallelism=4,     # 4 parallel threads
    hash_len=32,
    salt_len=16,
    type=Type.ID,  # Argon2id (default in argon2-cffi 21.2+)
)


def hash_password(password: str) -> str:
    """Hash a plaintext password with Argon2id."""
    return _ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verify a plaintext password against an Argon2id hash."""
    try:
        return _ph.verify(hashed, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


# ──────────────────────────────────────
# FERNET AES ENCRYPTION (for API keys & tokens)
# ──────────────────────────────────────
def _get_fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY
    if not key:
        raise RuntimeError(
            "ENCRYPTION_KEY is not set. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext string using Fernet (AES-128-CBC + HMAC)."""
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a Fernet-encrypted string back to plaintext."""
    try:
        f = _get_fernet()
        return f.decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        raise ValueError("Failed to decrypt — invalid token or wrong encryption key.")


# ──────────────────────────────────────
# JWT TOKEN MANAGEMENT
# ──────────────────────────────────────
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT access token. Raises JWTError on failure."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


# Re-export for convenience
__all__ = [
    "hash_password", "verify_password",
    "encrypt_value", "decrypt_value",
    "create_access_token", "decode_access_token",
    "JWTError",
]
