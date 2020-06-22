const redis = require('redis');
const util = require('util');

class ContextLog {

    constructor(app, zone, host, port) {
        this.prefix = `${app}-${zone}-log-`;
        this.host = host;
        this.port = port;
    }

    initialize() {
        this.client = redis.createClient(this.port, this.host);
        this.clientGet = util.promisify(this.client.get).bind(this.client);
        this.clientSet = util.promisify(this.client.setnx).bind(this.client);

        this.notification = this.createNotification();
        this.subscriber = redis.createClient(this.port, this.host);
        this.subscriber.config('set', 'notify-keyspace-events', 'KEA');
        this.subscriber.psubscribe(`__keyspace@*__:${this.prefix}*`);
        this.subscriber.on('pmessage', () => this.notification.resolve());
    }

    createNotification() {
        let resolveFunc;
        const promise = new Promise(resolve => resolveFunc = resolve);
        promise.resolve = resolveFunc;
        return promise;
    }

    async get(index, wait = true) {
        let record = null;
        while (true) {
            record = await this.clientGet(this.prefix + index);
            if (record != null || !wait) {
                break;
            }
            await this.notification;
            this.notification = this.createNotification();
        }
        return JSON.parse(record);
    }

    async set(index, record) {
        return await this.clientSet(this.prefix + index, JSON.stringify(record));
    }

}

module.exports = ContextLog;
