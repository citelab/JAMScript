'use strict';

const RedisClient = require('./');

const cli = new RedisClient({
        host: '127.0.0.1',
        port: 6379,
        maxRetries: -1,
        auth: null,
        db: null,
        autoConnect: true,
        doNotRunQuitOnEnd: true,
});

cli.on('ready', () => console.log('ready'));
cli.on('reconnecting', retry => console.log('reconnecting...', retry));
cli.on('error', e => console.log(e));

