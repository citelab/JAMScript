//==========================================================================
// Things that are used all over and don't have another locical location
//==========================================================================

module.exports = {

    // define the types of the nodes in an enum
    NodeType: Object.freeze({
        DEVICE: 'DEVICE',
        FOG: 'FOG',
        CLOUD: 'CLOUD'
    }),

    mqttBrokerUrl: 'tcp://localhost:1883',

    localhost: '127.0.0.1'

}
