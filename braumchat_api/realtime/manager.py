from dataclasses import dataclass
from typing import Dict, List
from collections import defaultdict

from fastapi import WebSocket


@dataclass
class Connection:
    websocket: WebSocket
    user_id: int


class ConnectionManager:
    """Tracks websocket connections per channel and user."""

    def __init__(self) -> None:
        # channel_key -> list[Connection]
        self.active_connections: Dict[str, List[Connection]] = defaultdict(list)

    async def connect(self, channel_key: str, websocket: WebSocket, user_id: int) -> None:
        await websocket.accept()
        self.active_connections[channel_key].append(
            Connection(websocket=websocket, user_id=user_id)
        )

    async def disconnect(self, channel_key: str, websocket: WebSocket) -> None:
        connections = self.active_connections.get(channel_key, [])
        self.active_connections[channel_key] = [
            c for c in connections if c.websocket is not websocket
        ]
        if not self.active_connections[channel_key]:
            self.active_connections.pop(channel_key, None)

    async def broadcast(self, channel_key: str, message: dict) -> None:
        conns = list(self.active_connections.get(channel_key, []))
        for conn in conns:
            try:
                await conn.websocket.send_json(message)
            except Exception:
                # ignore send errors but drop dead connections
                await self.disconnect(channel_key, conn.websocket)

    def user_connection_count(self, channel_key: str, user_id: int) -> int:
        return sum(1 for c in self.active_connections.get(channel_key, []) if c.user_id == user_id)

    def connected_users(self, channel_key: str) -> List[int]:
        return list({c.user_id for c in self.active_connections.get(channel_key, [])})


# singleton manager
manager = ConnectionManager()
