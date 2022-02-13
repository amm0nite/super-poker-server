import express from 'express';
import basicAuth from 'express-basic-auth';
import Prom from 'prom-client';

const METRICS_PORT = 8081;

export class Metrics {
    constructor() {
        this.app = express();
        this.port = METRICS_PORT;

        this.setup();
    }

    setup() {
        if (process.env.PROMETHEUS_PASSWORD) {
            this.app.use(basicAuth({
                users: {
                    'Prometheus': process.env.PROMETHEUS_PASSWORD
                }
            }));
        }

        this.app.get('/metrics', async (req, res) => {
            return res.end(await Prom.register.metrics());
        });
    }

    start() {
        this.clientGauge = new Prom.Gauge({
            name: 'super_poker_client',
            help: 'Super poker client count'
        });
        this.roomGauge = new Prom.Gauge({
            name: 'super_poker_room',
            help: 'Super poker room count'
        });

        this.server = this.app.listen(this.port, () => {
            console.log(`Metrics listening on port ${this.port}`);
        });
    }

    stop() {
        Prom.register.clear();

        if (this.server) {
            this.server.close();
        }
    }

    incClientCount() {
        this.clientGauge.inc();
    }

    decClientCount() {
        this.clientGauge.dec();
    }

    incRoomCount() {
        this.roomGauge.inc();
    }

    decRoomCount() {
        this.roomGauge.dec();
    }
}
