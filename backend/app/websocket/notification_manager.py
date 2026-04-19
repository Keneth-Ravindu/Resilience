from collections import defaultdict
from fastapi import WebSocket


class NotificationConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = defaultdict(list)

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id] = [
                conn for conn in self.active_connections[user_id] if conn != websocket
            ]
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_to_user(self, user_id: int, payload: dict):
        if user_id not in self.active_connections:
            return

        dead_connections = []

        for connection in self.active_connections[user_id]:
            try:
                await connection.send_json(payload)
            except Exception:
                dead_connections.append(connection)

        for connection in dead_connections:
            self.disconnect(user_id, connection)


notification_manager = NotificationConnectionManager()