

module.exports = {

    globals: {
        NodeType: Object.freeze({
            DEVICE: 'DEVICE',
            FOG: 'FOG',
            CLOUD: 'CLOUD'
        }),
        localhost: '127.0.0.1'
    },

    mqtt: {
        brokerUrl: 'tcp://localhost:1883'
    },

    mdns: {
        retries: 10,
        retryInterval: 10000, // 10 seconds
        ipCheckInterval: 120000 // 2 minutes (unlikely for IP on LAN to change)
    }
}
