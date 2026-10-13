"""Low-level iClub ASP.NET SignalR 2.1 WebSocket transport.

Derived from user's ModernFITCLUB project, not official API documentation.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any
from urllib.parse import urlencode

import httpx
import websockets

BASE_URL = "https://online.iclub.sk"
LOG = logging.getLogger(__name__)


class IClubError(Exception):
    def __init__(self, message: str, *, code: str = "ICLUB_ERROR", retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


class AuthenticationError(IClubError):
    pass


class TransportError(IClubError):
    pass


def guid() -> str:
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    import base64
    import hashlib
    return base64.b64encode(hashlib.sha256(password.encode("utf-8")).digest()).decode("ascii")


def unwrap_result(message: dict[str, Any]) -> Any:
    if message.get("E"):
        error = message["E"]
        msg = error if isinstance(error, str) else error.get("Message", str(error)) if isinstance(error, dict) else str(error)
        _raise_remote(msg)
    envelopes = message.get("R")
    result = envelopes[0] if isinstance(envelopes, list) and envelopes else None
    if not result:
        return None
    if result.get("Left"):
        left = result["Left"]
        _raise_remote(left if isinstance(left, str) else left.get("Message", str(left)) if isinstance(left, dict) else str(left))
    if result.get("State") != 2:
        raise TransportError("Unsuccessful iClub hub state", code="REMOTE_STATE", retryable=True)
    right = result.get("Right")
    if not isinstance(right, list):
        return right
    if len(right) == 1:
        return right[0]
    return right


def _raise_remote(message: str) -> None:
    import re
    if re.search(r"not\s+logged\s+in|unauthenticated|unauthorized|neprihl[aá]sen", message, re.I):
        raise AuthenticationError("iClub session expired", code="SESSION_EXPIRED")
    raise IClubError(message, code="REMOTE_HUB_ERROR", retryable=True)


class SignalRTransport:
    """One connection per account; concurrent invocations are correlated by SignalR ID."""

    def __init__(self, *, base_url: str = BASE_URL, timeout: float = 20.0, http_client: httpx.AsyncClient | None = None):
        if not base_url.startswith("https://"):
            raise ValueError("iClub transport requires HTTPS")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._owns_http = http_client is None
        self._http = http_client or httpx.AsyncClient(timeout=timeout, follow_redirects=False, headers={"User-Agent": "iClubUnofficial/0.1"})
        self._socket: Any = None
        self._receiver: asyncio.Task | None = None
        self._pending: dict[str, asyncio.Future] = {}
        self._next_id = 0
        self._lock = asyncio.Lock()
        self._closed = False

    async def connect(self) -> None:
        if self._socket is not None:
            return
        if self._closed:
            raise TransportError("Transport was closed", code="TRANSPORT_CLOSED")
        async with self._lock:
            if self._socket is not None:
                return
            query = urlencode({"clientProtocol": "2.1", "connectionData": "[]", "_": int(time.time() * 1000)})
            try:
                negotiated = await self._http.get(f"{self.base_url}/signalr/negotiate?{query}")
                negotiated.raise_for_status()
                token = negotiated.json()["ConnectionToken"]
                cookies = "; ".join(f"{k}={v}" for k, v in self._http.cookies.items())
                connection_data = {"transport": "webSockets", "clientProtocol": "2.1", "connectionToken": token, "connectionData": "[]"}
                url = self.base_url.replace("https://", "wss://", 1) + "/signalr/connect?" + urlencode({**connection_data, "tid": 0})
                headers = {"Cookie": cookies} if cookies else {}
                sock = await websockets.connect(url, origin=self.base_url, additional_headers=headers, open_timeout=self.timeout, max_size=16 * 1024 * 1024)
                try:
                    start = await self._http.get(self.base_url + "/signalr/start?" + urlencode(connection_data))
                    start.raise_for_status()
                except Exception:
                    await sock.close()
                    raise
                self._socket = sock
                self._receiver = asyncio.create_task(self._read_loop())
            except (httpx.HTTPError, OSError, TimeoutError, websockets.exceptions.WebSocketException, ValueError, KeyError) as exc:
                raise TransportError(f"Could not establish iClub connection: {type(exc).__name__}", code="CONNECTION_FAILED", retryable=True) from exc

    async def invoke(self, hub: str, method: str, args: list[Any], *, timeout: float | None = None) -> Any:
        await self.connect()
        if not hub or not method:
            raise ValueError("hub and method are required")
        call_id = str(self._next_id)
        self._next_id += 1
        future = asyncio.get_running_loop().create_future()
        self._pending[call_id] = future
        try:
            await self._socket.send(json.dumps({"H": hub, "M": method, "A": args, "I": call_id}, separators=(",", ":")))
            return await asyncio.wait_for(future, timeout=timeout or self.timeout)
        except asyncio.TimeoutError as exc:
            raise TransportError("iClub hub request timed out", code="REMOTE_TIMEOUT", retryable=True) from exc
        except websockets.exceptions.WebSocketException as exc:
            raise TransportError("iClub WebSocket failed", code="SOCKET_FAILED", retryable=True) from exc
        finally:
            self._pending.pop(call_id, None)
            if not future.done():
                future.cancel()

    async def _read_loop(self) -> None:
        try:
            async for raw in self._socket:
                try:
                    value = json.loads(raw)
                    if not isinstance(value, dict) or "I" not in value:
                        continue  # SignalR heartbeats/notifications, not an invocation response
                    future = self._pending.get(str(value["I"]))
                    if future is None or future.done():
                        continue
                    try:
                        future.set_result(unwrap_result(value))
                    except Exception as exc:
                        future.set_exception(exc)
                except (json.JSONDecodeError, TypeError):
                    LOG.debug("Ignoring malformed SignalR message")
        except asyncio.CancelledError:
            return
        except Exception:
            LOG.debug("SignalR receiver disconnected", exc_info=True)
        finally:
            self._socket = None
            for future in list(self._pending.values()):
                if not future.done():
                    future.set_exception(TransportError("iClub connection lost", code="CONNECTION_LOST", retryable=True))

    async def close(self) -> None:
        self._closed = True
        sock = self._socket
        self._socket = None
        receiver = self._receiver
        self._receiver = None
        if receiver:
            receiver.cancel()
        if sock:
            await sock.close()
        if receiver:
            try:
                await receiver
            except asyncio.CancelledError:
                pass
        if self._owns_http:
            await self._http.aclose()
