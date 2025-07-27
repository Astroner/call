import * as path from "path";
import { createServer } from "http";
import * as crypto from "crypto";

import * as express from "express";
import { WebSocketServer, WebSocket, createWebSocketStream } from "ws";

import { env } from "./env";
import { generateTurnCredentials } from "./generate-turn-creds";
import { Duplex } from "stream";

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({
    server: httpServer,
    path: "/signaling"
})

type Room = {
    status: "waiting" | "negotiating" | "rolling",
    code: string;
    host: WebSocket;
    hostStream: Duplex
}

const rooms = new Map<string, Room>();

const generateRoomCode = () => {
    let code;

    do {
        code = String(10000 + Math.floor(Math.random() * 10000)).slice(1);
    } while(rooms.has(code));

    return code;
}

app.use(express.json());
app.get("/", (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/index.html'));
})

app.get("/credentials", (req, res) => {
    res.json(generateTurnCredentials());
})

wss.on('connection', async (socket, message) => {
    const url = new URL(message.url ?? "", "https://example.com");

    const roomCode = url.searchParams.get('room');

    if(!roomCode) {
        if(rooms.size >= env.MAX_ROOMS) {
            socket.close(4000);
            return;
        }

        const newRoom = generateRoomCode();

        rooms.set(newRoom, {
            status: "waiting",
            code: newRoom,
            host: socket,
            hostStream: createWebSocketStream(socket)
        })

        socket.send(newRoom)
        
        return;
    }

    const room = rooms.get(roomCode);

    if(!room || room.status !== "waiting") {
        socket.close(4001);
        return;
    }
    room.status = "negotiating";

    const guestStream = createWebSocketStream(socket);

    room.hostStream.pipe(guestStream);
    guestStream.pipe(room.hostStream);

    const confirmation = await Promise.race([
        new Promise<"correct" | "nope">(resolve => {
            room.host.once('message', (data) => {
                if(data.toString() === "correct") {
                    resolve("correct")
                } else {
                    resolve("nope");
                }
            })
        }),
        new Promise<"nope">(resolve => setTimeout(() => resolve("nope"), 20000))
    ]);

    if(confirmation !== "correct") {
        guestStream.destroy();
        socket.close(4002);

        room.status = "waiting";

        return;
    }
    room.status = "rolling";

    room.host.onclose = () => {
        socket.close(4003);

        guestStream.destroy();
        room.hostStream.destroy();


        rooms.delete(roomCode);
    }

    socket.onclose = () => {
        room.host.close(4003);

        guestStream.destroy();
        room.hostStream.destroy();


        rooms.delete(roomCode);
    }
})

httpServer.listen(env.PORT, env.HOST, () => {
    const addr = httpServer.address();
    if(!addr) return;

    if(typeof addr === "string") {
        console.log(`Server started: ${addr}`);
        return;
    }
    

    console.log(`Server started ${addr.address}:${addr.port}`);
})
