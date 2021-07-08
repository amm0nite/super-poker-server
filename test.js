import WebSocket from 'ws';
import { Server } from './server.js';

describe('server', function() {
    this.timeout(1000);

    const server = new Server();
    const address = 'ws://127.0.0.1:' + server.port;
    server.start();

    it('should be able to connect', function(done) {
        const ws = new WebSocket(address);
        ws.on('open', () => {
            return done();
        });
    });

    it('should send a welcome message', function(done) {
        const expected = { message: 'welcome' };
        const ws = new WebSocket(address);
        ws.on('message', (content) => {
            if (content === JSON.stringify(expected)) {
                return done();
            }
            return done(new Error('wrong welcome message'));
        });
    });

    it('should do room selection', function(done) {
        const type = 'room';
        const room = 'home';
        const expected = { type, room };
        const ws = new WebSocket(address);
        ws.on('open', () => {
            ws.send(JSON.stringify({ type, room }));
        });
        ws.on('message', (content) => {
            if (content === JSON.stringify(expected)) {
                return done();
            }
        });
    });

    it('should do room broadcast', function(done) {
        const alice = new WebSocket(address);
        const bob = new WebSocket(address);

        const enterRoomMessage = JSON.stringify({ type: 'room', room: 'test' });
        const enteredRoomMessage = JSON.stringify({ type: 'room', room: 'test' });

        const aliceMessage = 'hello bob';
        const aliceTalkMessage = JSON.stringify({ type: 'talk', message: aliceMessage });

        alice.on('open', () => {
            alice.send(enterRoomMessage);
        });
        bob.on('open', () => {
            bob.send(enterRoomMessage);
        });

        let aliceInRoom = false;
        let bobInRoom = false;

        const onEnter = () => {
            if (aliceInRoom && bobInRoom) {
                alice.send(aliceTalkMessage);
            }
        }

        alice.on('message', (content) => {
            if (content === enteredRoomMessage) {
                aliceInRoom = true;
                return onEnter();
            }
        });
        bob.on('message', (content) => {
            if (content === enteredRoomMessage) {
                bobInRoom = true;
                return onEnter();
            }
            const data = JSON.parse(content);
            if (data.type === 'talk' && data.message === aliceMessage) {
                return done();
            }
        });
    });

    after(function() {
        server.stop();
    });
});
