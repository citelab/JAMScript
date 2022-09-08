'use strict';
/**
 * This is the global constant storage. This must be used without hardcoding constant values
 * into the source code.
 */
module.exports = Object.freeze({
    globals: {
        WorkerType: {
            SCHEDULER: 'scheduler',
            APPLICATION: 'application',
            LIBRARY: 'library'
        },
        ChannelName: {
            EVENT_BUS: 'event-bus-channel',
            APP_LIBRARY: 'app-lib-broadcast'
        },
        EventName: {
            NONE_UP: 'none_up',
            DATA_UP: 'data_up',
            DATA_DOWN: 'data_down',
            FOG_UP: 'fog_up',
            FOG_DOWN: 'fog_down',
            FOG_DATA_UP: 'fog_data_up',
            FOG_DATA_DOWN: 'fog_data_down',
            CLOUD_UP: 'cloud_up',
            CLOUD_DOWN: 'cloud_down',
            CLOUD_DATA_UP: 'cloud_data_up',
            CLOUD_DATA_DOWN: 'cloud_data_down'
        },
        NodeType: {
            DEVICE: 'device',
            FOG: 'fog',
            CLOUD: 'cloud'
        },
        Protocol: {
            MQTT: 2,
            MDNS: 1
        },
        Counts: {
            ACK_TIMEOUTS: 3,
            WAIT_COUNT: 3
        },
        Task: {
            COMPLETED: 1,
            RESULT_NEEDED: 1
        },
        Timeouts: {
            J2C_DEVICE: 301,      // Values in milliseconds
            J2J_FOG:    301,
            J2J_CLOUD:  301,       // Sometimes 300 milliseconds does NOT work - very weird!
            PING_DURATION: 10000
        },
        CloudPolicy: {
            FITNESS: 0.95
        }
    },
    TTConfig: {
        CLOCK_INTERVAL: 200,
        CLOCK_COUNT: 10,
        MAX_RETRIES: 3,
        ACK_BOOST: 200,
        BOOST_LIMIT: 5,
    },
    StateNames: {
        INITIAL: 1,
        ACK_RECVD: 2,
        BOOSTED: 3,
        RES_RECVD: 4
    },
    CmdNames: {
        CONTROL_CMDS_BEG: 1000,
        REGISTER: 1001,
        REGISTER_ACK: 1002,
        NEW_REGISTER: 1005,
        OLD_REGISTER: 1006,
        PING: 1020,
        PONG: 1021,
        GET_CLOUD_FOG_INFO: 1100,
        PUT_CLOUD_FOG_INFO: 1101,
        REF_CLOUD_FOG_INFO: 1102,
        FOG_ADD_INFO: 1150,
        FOG_DEL_INFO: 1151,
        CLOUD_ADD_INFO: 1152,
        CLOUD_DEL_INFO: 1153,
        NONE_INFO: 1160,
        CONTROL_CMDS_END: 1200,
        DISCOVERY_CMDS_BEG: 1500,
        WHERE_IS_CTRL: 1550,
        HERE_IS_CTRL: 1551,
        DISCOVERY_CMDS_END: 1600,
        PROBING_CMDS_BEG: 2000,
        START_PROBING: 2010,
        PROBE: 2020,
        PROBE_REGISTER: 2100,
        PROBE_ACK: 2110,
        PROBING_CMDS_END: 2500,
        SCHEDULE_CMDS_BEG: 3000,
        GET_SCHEDULE: 3010,
        PUT_SCHEDULE: 3020,
        PUT_EXEC_STATS: 3030,
        SCHEDULE_CMDS_END: 3900,
        EXEC_CMDS_BEG: 5000,
        REXEC: 5010,
        REXEC_NAK: 5020,
        REXEC_ACK: 5030,
        REXEC_RES: 5040,
        REXEC_ERR: 5045,
        REXEC_SYN: 5050,
        GET_REXEC_RES: 5060,
        REXEC_DONE: 5070,
        MEXEC: 5100,
        MEXEC_NAK: 5101,
        MEXEC_ACK: 5301,
        MEXEC_RES: 5302,
        MEXEC_ERR: 5303,
        GET_MEXEC_RES: 5303,
        MEXEC_DONE: 5310,
        DONE: 5800,
        COND_FALSE: 5810,
        FUNC_NOT_FOUND: 5820,
        EXEC_CMDS_END: 5900,
    },
    FogPolicy: {
        numFogs: 3,
        mostReponsive: 'MostResponsive',
        leastDistance: 'LeastDistance'
    },
    CloudPolicy: {
        fitness: 0.3
    },
    mqtt: {
        keepAlive: 10, // 10 seconds
        connectionTimeout: 10000, // 10 seconds
        retries: 5,
        retryInterval: 2000, // 2 seconds
        longRetryInterval: 60000, // 1 minute
        localBrokerUrl: 'tcp://127.0.0.1:17730', // change port number so that we can have many broker instances
        brokerUrl: 'http://127.0.0.1:18830',
        brokerUrlBackup: 'http://127.0.0.1:18831',
        brokerUrlFogIP: '127.0.0.1',
        brokerUrlFogPort: '18832',
    },
    mdns: {
        retries: 5,
        shortRetryInterval: 100, // 0.1s
        retryInterval: 2000, // 2 seconds
        longRetryInterval: 60000, // 1 minute
        // checkBrokerUrlInterval: 100, //0.1 seconds
    },
    multicast: {Prefix: "224.1.1", Port: 35600}
});
