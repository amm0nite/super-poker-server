import WebSocket from 'ws';
import { Server } from './server.js';

describe('server', function() {
    this.timeout(1000);

    const server = new Server();
    const address = 'ws://127.0.0.1:' + server.port;
    server.start();

    it('should be able to connect', async function() {
        const ws = new WebSocket(address);
        return new Promise((resolve, reject) => {
            ws.on('open', () => {
                return resolve();
            });
        });
    });

    it('should send a welcome message', async function() {
        const expected = { message: 'welcome' };
        const ws = new WebSocket(address);
        return new Promise((resolve, reject) => {
            ws.on('message', (content) => {
                if (content === JSON.stringify(expected)) {
                    return resolve();
                }
                return reject();
            });
        });
    });

    after(function() {
        server.stop();
    });
});
