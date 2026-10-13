"""Unofficial iClub Python SDK. No relationship to the iClub operators."""
from .client import IClub
from .transport import IClubError, AuthenticationError, TransportError, SignalRTransport

__all__ = ["IClub", "IClubError", "AuthenticationError", "TransportError", "SignalRTransport"]
__version__ = "0.1.0"
