import { Poker } from './poker.js';
import { Metrics } from './metrics.js';
import { Webhook } from './webhook.js';

export class Server {
    constructor() {
        this.poker = new Poker();
        this.metrics = new Metrics();
        this.webhook = new Webhook();

        this.poker.on('connect', (detail) => {
            this.metrics.incClientCount();
        });
        this.poker.on('disconnect', (detail) => {
            this.metrics.decClientCount();
        });
        this.poker.on('create', (detail) => {
            this.metrics.incRoomCount();
            this.webhook.post('create', detail);
        });
        this.poker.on('delete', (detail) => {
            this.metrics.decRoomCount();
            this.webhook.post('delete', detail);
        });
    }

    start() {
        this.poker.start();
        this.metrics.start();
    }

    stop() {
        this.poker.stop();
        this.metrics.stop();
    }
}
