import WebSocket from 'ws';
import { randomUUID } from 'crypto';

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
    constructor(name) {
        this.name = name;
        this.refresh();
    }

    refresh() {
        this.hb = new Date();
    }

    isOld() {
        const elapsed = (new Date()) - this.hb;
        return elapsed > ROOM_LIFETIME;
    }
}

class Server {
    constructor() {
        this.port = 8080;
        this.rooms = [];
    }

    start() {
        console.log('Server listening on port ' + this.port);
        this.wss = new WebSocket.Server({ port: this.port });
        this.wss.on('connection', (ws) => this.onConnection(ws));
        setInterval(() => this.pingEveryone(), CLIENT_PING);
    }

    onConnection(ws) {
        ws.client = new Client();

        ws.on('pong', () => ws.client.alive = true);
        ws.on('message', (content) => this.onMessage(ws, content));

        this.send(ws, { message: 'welcome' });
    }

    onMessage(ws, content) {
        try {
            const message = JSON.parse(content);
            if (message.type === 'room') {
                this.handleRoom(ws, message);
            }
            if (message.type === 'talk') {
                this.handleTalk(ws, message);
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
        const room = this.findRoom(name);
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
        if (!message.room) {
            return;
        }

        message.author = ws.client.uuid;
        this.sendToRoom(room, message);
    }

    handleRoom(ws, message) {
        const name = message.room;
        let room = this.findRoom(name);
        if (!room) {
            room = this.createRoom(name);
            room.owner = ws.client.uuid;
        }

        ws.client.room = message.room;
        this.send(ws, { type: 'room', room: room.name });
    }

    createRoom(name) {
        const room = new Room(name);
        this.rooms.push(room);
        this.checkRoom(name);
    }

    findRoom(name) {
        return this.rooms.find((room) => room.name === name);
    }

    deleteRoom(name) {
        this.rooms = this.rooms.filter((room) => room.name !== name);
    }

    checkRoom(name) {
        if (room.isOld()) {
            this.deleteRoom(name);
            return;
        }
        setTimeout(() => this.checkRoom(room), ROOM_CHECK);
    }

    pingEveryone() {
        this.wss.clients.forEach((ws) => {
            if (!ws.client.alive) {
                ws.terminate();
                return;
            }

            ws.client.alive = false;
            ws.ping();
        });
    }
}

const server = new Server();
server.start();
