/* eslint-disable no-undef */

import WebSocket from 'ws';
import { Server } from './server.js';

describe('server', function() {
    this.timeout(1000);

    let server = null;
    let address = null;

    beforeEach(function() {
        server = new Server();
        server.start();

        address = 'ws://127.0.0.1:' + server.port;
    });

    afterEach(function() {
        server.stop();
    });

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

    it('should handle room selection', function(done) {
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

    it('should broadcast talk message in the room', function(done) {
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
        };

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

    it('should handle check room message', function(done) {
        const meta = { test: true };
        server.createRoom('room2', 'owner1', meta);

        const ws = new WebSocket(address);
        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'check', room: 'room1' }));
            ws.send(JSON.stringify({ type: 'check', room: 'room2' }));
        });

        let expected = [
            { type: 'check', room: 'room1', exists: false },
            { type: 'check', room: 'room2', exists: true, meta },
        ];
        ws.on('message', (content) => {
            expected = expected.filter((e) => content !== JSON.stringify(e));
            if (expected.length == 0) {
                done();
            }
        });
    });
});
