import os
import logging
from functools import lru_cache

import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt

logger = logging.getLogger(__name__)

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE")
ALGORITHMS = ["RS256"]
AUTH0_JWKS_TIMEOUT_SECONDS = float(os.getenv("AUTH0_JWKS_TIMEOUT_SECONDS", "5"))

if not AUTH0_DOMAIN or not AUTH0_AUDIENCE:
    # Backend can still start but will reject requests until properly configured
    print("Warning: AUTH0_DOMAIN or AUTH0_AUDIENCE not set for Auth0 integration")

http_bearer = HTTPBearer()
LOG_JWT_PAYLOADS = os.getenv("LOG_JWT_PAYLOADS", "").lower() in {"1", "true", "yes"}


@lru_cache()
def _get_jwks():
    jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    response = requests.get(jwks_url, timeout=AUTH0_JWKS_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json()


def _find_rsa_key(jwks: dict, kid: str) -> dict | None:
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            # python-jose does not provide a public ``algorithms`` module like
            # PyJWT. We therefore return the JWK values directly so ``jwt.decode``
            # can validate the signature.
            return {
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key.get("use"),
                "n": key["n"],
                "e": key["e"],
            }
    return None


def _get_rsa_key(token: str):
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    rsa_key = _find_rsa_key(_get_jwks(), kid)
    if rsa_key:
        return rsa_key

    # Auth0 may rotate signing keys while this process still has a cached JWKS.
    cache_clear = getattr(_get_jwks, "cache_clear", None)
    if cache_clear:
        cache_clear()
    rsa_key = _find_rsa_key(_get_jwks(), kid)
    if rsa_key:
        return rsa_key

    raise HTTPException(status_code=401, detail="Invalid authorization header")


def verify_jwt_token(token: str) -> dict:
    try:
        rsa_key = _get_rsa_key(token)
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=ALGORITHMS,
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/",
        )
        if LOG_JWT_PAYLOADS:
            logger.info("JWT payload: %s", payload)
        else:
            logger.debug("JWT validated for user %s", payload.get("sub"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    return payload


def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)):
    return verify_jwt_token(credentials.credentials)
