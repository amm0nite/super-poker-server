import axios from 'axios';

export class Webhook {
    constructor() {
        if (process.env.WEBHOOK_URL) {
            this.url = process.env.WEBHOOK_URL;
            console.log(`Webhook set to ${this.url}`);
        }
    }

    async post(event, detail) {
        if (!this.url) {
            return;
        }

        if (!detail) detail = {};
        if (typeof detail.lean === 'function') detail = detail.lean();

        const payload = { event, ...detail };

        try {
            await axios.post(this.url, payload, { timeout: 5000 });
        } catch (err) {
            console.log(`Webhook failed: ${err.message}`);
        }
    }
}
