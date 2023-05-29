'use strict';
const CmdNames = require('./constants').CmdNames;

/* 
 * JAMProtocol class.
 * This class contains static methods for the key protocols. 
 * These methods create the message objects in JSON format and return them. 
 * They are NOT CBOR encoded or sent to the MQTT broker. 
 */ 
class JAMProtocol {

    // TODO: Fix all of the below according to the protocol definition... in Notion
    static createRemoteTaskReq(name, argsig, params, nodeid, taskid, rrequired) {
        return {cmd: CmdNames.REXEC,
                subcmd: rrequired? 1 : 0,
                fn_name: name,
                fn_argsig: argsig,
                nodeid: nodeid,
                taskid: taskid,
                args: params};
    }

    static createRemoteGetRes(name, nodeid, taskid) {
        return {cmd: CmdNames.GET_REXEC_RES, fn_name: name, taskid: taskid, nodeid: nodeid};
    }

    static createMachGetRes(name, nodeid, taskid) {
        return {cmd: CmdNames.GET_MEXEC_RES, fn_name: name, taskid, nodeid: nodeid};
    }

    static createMachTaskReq(name, params, nodeid, taskid) {
        return {cmd: CmdNames.MEXEC,
                fn_name: name,
                nodeid: nodeid,
                taskid: taskid,
                args: params};
    }

    static createAck(cmd, taskid) {
        return {cmd: cmd, taskid: taskid};
    }

    static createResults(cmd, taskid, data) {
        return {cmd: cmd, taskid: taskid, args: [ data ]};
    }

    static createError(cmd, taskid) {
        return {cmd: cmd, taskid: taskid, args: [ data ]};
    }

    static createHereIsCtrl(host, port) {
        var msg =  {cmd: CmdNames.HERE_IS_CTRL, 
                    subcmd: 0,
                    args: [host, port]};
        return msg;
    }
    
    static createFogAdditionPCFI(id, ip, port) {
        var tmsg = {cmd: CmdNames.PUT_CLOUD_FOG_INFO,
                    subcmd: CmdNames.FOG_ADD_INFO,
                    nodeid: id,
                    args: [ip, port]};
        return tmsg;
    }

    static createFogDeletionPCFI(id) {
        return {cmd: CmdNames.PUT_CLOUD_FOG_INFO,
                    subcmd: CmdNames.FOG_DEL_INFO,
                    nodeid: id,
                    args: []};
    }

    static createCloudAdditionPCFI(id, ip, port) {
        return {cmd: CmdNames.PUT_CLOUD_FOG_INFO,
                    subcmd: CmdNames.CLOUD_ADD_INFO,
                    nodeid: id,
                    args: [ip, port]};
    }

    static createCloudDeletionPCFI(id) {
        return {cmd: CmdNames.PUT_CLOUD_FOF_INFO,
                    subcmd: CmdNames.CLOUD_DEL_INFO,
                    nodeid: id,
                    args: []};
    }

    static createNonePCFI() {
        return {cmd: CmdNames.PUT_CLOUD_FOG_INFO, subcmd: CmdNames.NONE_INFO};
    }

    /*
     * No need to JSON.stringify(), because the message is in string format already.
     */
    static createPingReq() {
        return {cmd: CmdNames.PING};
    }
}

module.exports = JAMProtocol;
