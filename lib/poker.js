import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import EventEmitter from 'events';

const POKER_PORT = 8080;
const ROOM_LIFETIME = 600 * 1000;
const ROOM_CHECK = 60 * 1000;
const CLIENT_PING = 2 * 1000;

class Client {
    constructor() {
        this.uuid = randomUUID();
        this.room = null;
        this.alive = true;
    }
}

class Room {
    constructor(name, owner, meta) {
        this.name = name;
        this.owner = owner;
        this.meta = meta;

        this.timeout = null;
        this.refresh();
    }

    refresh() {
        this.hb = new Date();
    }

    isOld() {
        const elapsed = (new Date()) - this.hb;
        return elapsed > ROOM_LIFETIME;
    }

    lean() {
        return { name: this.name };
    }
}

export class Poker extends EventEmitter {
    constructor() {
        super();

        this.port = POKER_PORT;
        this.rooms = new Map();

        this.pingInterval = null;
    }

    start() {
        console.log('Poker listening on port ' + this.port);
        this.wss = new WebSocketServer({ port: this.port });
        this.wss.on('connection', (ws) => this.onConnection(ws));
        this.pingInterval = setInterval(() => this.pingEveryone(), CLIENT_PING);
    }

    onConnection(ws) {
        ws.client = new Client();
        this.emit('connect', ws.client);

        ws.on('pong', () => ws.client.alive = true);
        ws.on('message', (content, isBinary) => this.onMessage(ws, content, isBinary));
        ws.on('close', () => this.emit('disconnect', ws.client));

        this.send(ws, { message: 'welcome' });
    }

    onMessage(ws, content, isBinary) {
        if (isBinary) {
            return;
        }

        try {
            const message = JSON.parse(content.toString());
            if (message.type === 'talk') {
                return this.handleTalk(ws, message);
            }
            if (message.type === 'check') {
                return this.handleCheck(ws, message);
            }
            if (message.type === 'room') {
                return this.handleRoom(ws, message);
            }
        } catch (err) {
            console.log(err);
        }
    }

    send(ws, message) {
        if (ws.readyState !== WebSocket.OPEN) {
            return;
        }
        ws.send(JSON.stringify(message));
    }

    sendToRoom(name, message) {
        const room = this.rooms.get(name);
        if (!room) {
            return;
        }

        room.refresh();

        this.wss.clients.forEach((ws) => {
            setImmediate(() => {
                if (ws.client.uuid === message.author) {
                    return;
                }
                if (ws.client.room !== room.name) {
                    return;
                }
                this.send(ws, message);
            });
        });
    }

    handleTalk(ws, message) {
        if (!ws.client.room) {
            return;
        }

        message.author = ws.client.uuid;
        this.sendToRoom(ws.client.room, message);
    }

    handleRoom(ws, message) {
        const name = message.room;
        let room = this.rooms.get(name);
        if (!room) {
            room = this.createRoom(name, ws.client.uuid, message.meta);
        }

        ws.client.room = message.room;
        const response = {
            type: 'room',
            room: room.name,
            meta: room.meta,
        };

        this.send(ws, response);
    }

    handleCheck(ws, message) {
        const name = message.room;
        let room = this.rooms.get(name);

        const response = { type: 'check', room: name, exists: false };
        if (room) {
            response.exists = true;
            response.meta = room.meta;
        }

        this.send(ws, response);
    }

    createRoom(name, owner, meta) {
        const room = new Room(name, owner, meta);
        this.rooms.set(name, room);
        this.checkRoom(name);
        this.emit('create', room);
        return room;
    }

    deleteRoom(name) {
        const room = this.rooms.get(name);
        if (!room) {
            return;
        }

        clearTimeout(room.timeout);
        this.rooms.delete(name);
        this.emit('delete', room);
    }

    checkRoom(name) {
        const room = this.rooms.get(name);
        if (!room) {
            return;
        }
        if (room.isOld()) {
            this.deleteRoom(name);
            return;
        }
        room.timeout = setTimeout(() => this.checkRoom(name), ROOM_CHECK);
    }

    pingEveryone() {
        this.wss.clients.forEach((ws) => {
            setImmediate(() => {
                if (!ws.client.alive) {
                    ws.terminate();
                    return;
                }

                ws.client.alive = false;
                ws.ping();
            });
        });
    }

    stop() {
        for (const room of this.rooms.values()) {
            this.deleteRoom(room.name);
        }

        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        if (this.wss) {
            this.wss.close();
            for (const ws of this.wss.clients) {
                ws.terminate();
            }
        }
    }
}
