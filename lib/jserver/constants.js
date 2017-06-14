

module.exports = {

    globals: {
        NodeType: Object.freeze({
            DEVICE: 'device',
            FOG: 'fog',
            CLOUD: 'cloud'
        }),
        localhost: '127.0.0.1'
    },

    mqtt: {
        keepAlive: 30, // 30 seconds
        connectionTimeout: 10000, // 10 seconds
        brokerUrl: 'tcp://localhost:1883'
    },

    mdns: {
        retries: 10,
        retryInterval: 10000, // 10 seconds
        ipCheckInterval: 120000 // 2 minutes (unlikely for IP on LAN to change)
    },

    localStorage: {
        scanInterval: 5000
    }
}
