from collections import defaultdict
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = defaultdict(list)

    async def connect(self, conversation_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[conversation_id].append(websocket)

    def disconnect(self, conversation_id: int, websocket: WebSocket):
        connections = self.active_connections.get(conversation_id, [])
        if websocket in connections:
            connections.remove(websocket)

        if not connections and conversation_id in self.active_connections:
            del self.active_connections[conversation_id]

    async def broadcast_to_conversation(self, conversation_id: int, payload: dict):
        connections = self.active_connections.get(conversation_id, [])
        disconnected = []

        for connection in connections:
            try:
                await connection.send_json(payload)
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(conversation_id, connection)


manager = ConnectionManager()