'use strict';
/**
 * This is the global constant storage. This must be used without hardcoding constant values
 * into the source code.
 */
module.exports = Object.freeze({
    globals: {
        ErrorCodes: {
            NoTask: 1
        },
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
            CLOUD: 'cloud',
            GLOBAL_REGISTRY: 'global_registry',
            LOCAL_REGISTRY: 'local_registry'
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
        RedisFuncs: {
            UF_READ_FIRST: 10,
            UF_READ_LAST: 11,
            DF_READ_TAIL: 12,
            DF_READ_HEAD: 13
        },
        Timeouts: {
            J2C_DEVICE: 301,      // Values in milliseconds
            J2J_FOG:    301,
            J2J_CLOUD:  301,       // Sometimes 300 milliseconds does NOT work - very weird!
            PING_DURATION: 10000,
            REXEC_ACK_TIMEOUT: 10,
            MEXEC_ACK_TIMEOUT: 10
        },
        CloudPolicy: {
            FITNESS: 0.95
        }
    },
    TTConfig: {
        CLOCK_INTERVAL: 200,
        CLOCK_COUNT: 3,
        MAX_RETRIES: 4,
        ACK_BOOST: 30,
        BOOST_LIMIT: 5,
    },
    StateNames: {
        INITIAL: 1,
        ACK_RECVD: 2,
        BOOSTED: 3,
        RES_RECVD: 4,
        CLOSING: 5,
        TIMEOUT: 6,
        ERR_RECVD: 7
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
        WHERE_IS_LOCAL_REGISTRY: 1560,
        HERE_IS_LOCAL_REGISTRY: 1561,
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
        GET_MEXEC_RES: 5304,
        MEXEC_DONE: 5310,
        DONE: 5800,
        COND_FALSE: 5810,
        FUNC_NOT_FOUND: 5820,
        EXEC_CMDS_END: 5900,
        SET_JSYS: 6000,
        SET_CONF: 6100,
        SET_LONG: 6110,
        SET_LAT: 6120,
        SET_REDIS: 6500,
        REDIS_STATE: 6600,
        FOG_DATA_UP: 6601,
        FOG_DATA_DOWN: 6602,
        CLOUD_DATA_UP: 6603,
        CLOUD_DATA_DOWN: 6604,
        HOIST_FOG: 6700,
        NORMAL: 6701,
        FORCE: 6702,
        PURGE: 6705,
        STOP: 7000
    },
    INQ_States: {
        STARTING: 1,
        STARTED: 2,
        COMPLETED: 3,
        RUNNING: 4
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
        brokerUrl: 'mqtt://127.0.0.1:18830',
        globalRegistryId: 'GLOBAL REGISTRY',
    },
    mdns: {
        retries: 5,
        shortRetryInterval: 100, // 0.1s
        retryInterval: 2000, // 2 seconds
        longRetryInterval: 60000, // 1 minute
        // checkBrokerUrlInterval: 100, //0.1 seconds
    },
    multicast: {Prefix: "224.1.1", rPort: 16000, sPort: 16500, Port: 35600}
});
