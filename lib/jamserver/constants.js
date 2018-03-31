

module.exports = Object.freeze({

    globals: {
        NodeType: {
            DEVICE: 'device',
            FOG: 'fog',
            CLOUD: 'cloud'
        },
        Status: {
            ONLINE: 'online',
            OFFLINE: 'offline'
        },
        Protocol: {
            MQTT: 2,
            MDNS: 1,
            LOCALSTORAGE: 0
        },
        Channel: {
            DEFAULT: 0,
            LOCAL: 1
        },
        Timeouts: {
            J2C_DEVICE: 300,      // Values in milliseconds
            J2J_FOG:    700,
            J2J_CLOUD:  1200,
            RUN_TABLE: 50
        },
        Cache: {
            LIMIT: 32
        },
        DelayMode: {
            NoDelay: "None",
            Random: "Random",
            Step: "Step"
        },
        localhost: '127.0.0.1'
    },

    mqtt: {
        keepAlive: 10, // 10 seconds
        connectionTimeout: 10000, // 10 seconds
        retries: 5,
        retryInterval: 2000, // 2 seconds
        longRetryInterval: 60000, // 1 minute
        localBrokerUrl: 'http://localhost:1883',
        brokerUrl: 'tcp://jamscript.madhacker.biz:1883'
    },

    mdns: {
        retries: 5,
        retryInterval: 2000, // 2 seconds
        longRetryInterval: 60000 // 1 minute
    },

    localStorage: {
        checkInInterval: 3000, // 3 seconds
        scanInterval: 3000, // 3 seconds
        queryRetries: 10,
        initLock: 'init.lock',
        stale: 1000, // 1 second
        numBins: 10, // number of fog and cloud bins to use
    }
});
