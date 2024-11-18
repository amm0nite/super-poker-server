/* eslint-disable no-undef */

import assert from 'assert';
import WebSocket from 'ws';
import axios from 'axios';
import express from 'express';
import bodyParser from 'body-parser';
import parsePrometheusTextFormat from 'parse-prometheus-text-format';

import { Server } from './lib/server.js';
import { Webhook } from './lib/webhook.js';

describe('server', function() {
    this.timeout(1000);

    let server = null;
    let pokerAddress = null;
    let metricsAddress = null;

    beforeEach(function() {
        server = new Server();
        server.start();

        pokerAddress = 'ws://127.0.0.1:' + server.poker.port;
        metricsAddress = 'http://127.0.0.1:' + server.metrics.port + '/metrics';
    });

    afterEach(function() {
        server.stop();
    });

    it('should be able to connect', function(done) {
        const ws = new WebSocket(pokerAddress);
        ws.on('open', () => {
            return done();
        });
    });

    it('should send a welcome message', function(done) {
        const expected = { message: 'welcome' };
        const ws = new WebSocket(pokerAddress);
        ws.on('message', (content) => {
            if (content.toString() === JSON.stringify(expected)) {
                return done();
            }
            return done(new Error('wrong welcome message'));
        });
    });

    it('should handle room selection', function(done) {
        const type = 'room';
        const room = 'home';
        const expected = { type, room };
        const ws = new WebSocket(pokerAddress);
        ws.on('open', () => {
            ws.send(JSON.stringify({ type, room }));
        });
        ws.on('message', (content) => {
            if (content.toString() === JSON.stringify(expected)) {
                return done();
            }
        });
    });

    it('should broadcast talk message in the room', function(done) {
        const alice = new WebSocket(pokerAddress);
        const bob = new WebSocket(pokerAddress);

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
            if (content.toString() === enteredRoomMessage) {
                aliceInRoom = true;
                return onEnter();
            }
        });
        bob.on('message', (content) => {
            if (content.toString() === enteredRoomMessage) {
                bobInRoom = true;
                return onEnter();
            }
            const data = JSON.parse(content.toString());
            if (data.type === 'talk' && data.message === aliceMessage) {
                return done();
            }
        });
    });

    it('should handle check room message', function(done) {
        const meta = { test: true };
        server.poker.createRoom('room2', 'owner1', meta);

        const ws = new WebSocket(pokerAddress);
        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'check', room: 'room1' }));
            ws.send(JSON.stringify({ type: 'check', room: 'room2' }));
        });

        let expected = [
            { type: 'check', room: 'room1', exists: false },
            { type: 'check', room: 'room2', exists: true, meta },
        ];
        ws.on('message', (content) => {
            expected = expected.filter((e) => content.toString() !== JSON.stringify(e));
            if (expected.length == 0) {
                done();
            }
        });
    });

    async function getMetrics() {
        const response = await axios.get(metricsAddress);
        const parsed = parsePrometheusTextFormat(response.data);

        const clientMetric = parsed.find((metric) => metric.name === 'super_poker_client');
        const roomMetric = parsed.find((metric) => metric.name === 'super_poker_room');

        return {
            'client': parseInt(clientMetric.metrics[0].value),
            'room': parseInt(roomMetric.metrics[0].value),
        };
    }

    it('should count the clients', async function() {
        let metrics = null;

        metrics = await getMetrics();
        assert.equal(metrics.client, 0);

        const ws = new WebSocket(pokerAddress);
        await new Promise((resolve) => {
            ws.on('open', () => {
                return resolve();
            });
        });
        metrics = await getMetrics();
        assert.equal(metrics.client, 1);

        ws.close();
        await new Promise((resolve) => {
            ws.on('close', () => {
                return resolve();
            });
        });
        metrics = await getMetrics();
        assert.equal(metrics.client, 0);
    });

    it('should count the rooms', async function() {
        let metrics = null;

        metrics = await getMetrics();
        assert.equal(metrics.room, 0);

        server.poker.createRoom('room1', 'owner1', {});
        metrics = await getMetrics();
        assert.equal(metrics.room, 1);

        server.poker.deleteRoom('room1');
        metrics = await getMetrics();
        assert.equal(metrics.room, 0);
    });

    it('should post the room events as webhooks', function(done) {
        const webhookPort = 8082;
        process.env.WEBHOOK_URL = `http://127.0.0.1:${webhookPort}/event`;
        server.webhook = new Webhook();

        const webhooks = [];

        const app = express().post('/event', bodyParser.json(), (req, res) => {
            webhooks.push(req.body);
            return res.status(200).json(webhooks);
        });

        const createEvent = { event: 'create', name: 'room1' };
        const deleteEvent = { event: 'delete', name: 'room1' };

        const webhookServer = app.listen(webhookPort, (err) => {
            if (err) done(err);

            server.poker.createRoom(createEvent.name, 'owner1', {});
            server.poker.deleteRoom(deleteEvent.name);

            setTimeout(() => {
                try {
                    assert.strictEqual(webhooks.length, 2);
                    assert.deepStrictEqual(webhooks.shift(), createEvent);
                    assert.deepStrictEqual(webhooks.shift(), deleteEvent);
                    done();
                } finally {
                    webhookServer.close();
                }
            }, 25);
        });
    });
});
