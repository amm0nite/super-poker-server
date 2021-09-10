import { Poker } from './poker.js';
import { Metrics } from './metrics.js';

export class Server {
    constructor() {
        this.poker = new Poker();
        this.metrics = new Metrics();

        this.poker.on('connect', () => {
            this.metrics.incClientCount();
        });
        this.poker.on('disconnect', () => {
            this.metrics.decClientCount();
        });
        this.poker.on('create', () => {
            this.metrics.incRoomCount();
        });
        this.poker.on('delete', () => {
            this.metrics.decRoomCount();
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
