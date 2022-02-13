import { Server } from './lib/server.js';

const server = new Server();
server.start();

process.on('SIGINT', () => {
    server.stop();
});
process.on('SIGTERM', () => {
    server.stop();
});
