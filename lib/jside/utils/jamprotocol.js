'use strict';
const   CmdNames = require('./constants').CmdNames,
        Timeouts = require('./constants').globals.Timeouts;

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
                oldid: "",
                taskid: taskid,
                args: params};
    }

    // there is no need for an 'oldid' because the node is trying to get the results for its own call
    static createRemoteGetRes(name, taskid, nodeid) {
        return {cmd: CmdNames.GET_REXEC_RES, fn_name: name, taskid: taskid, nodeid: nodeid, oldid: ""};
    }

    static createRemotePutRes(taskid, nodeid, oldid, res_sig, res) {
        return {cmd: CmdNames.REXEC_RES, taskid: taskid, nodeid: nodeid, oldid: oldid, fn_argsig: res_sig, args: [res]};
    }

    static createRemotePutAck(taskid, nodeid, oldid) {
        return {cmd: CmdNames.REXEC_ACK, taskid: taskid, nodeid: nodeid, oldid: oldid, fn_argsig: "i", args: [Timeouts.REXEC_ACK_TIMEOUT]};
    }

    static createRemotePutNak(taskid, nodeid, oldid, code) {
        return {cmd: CmdNames.REXEC_NAK, taskid: taskid, nodeid: nodeid, oldid: oldid, fn_argsig: "i", args: [code]};
    }

    static createMachTaskReq(name, params, nodeid, taskid, rrequired) {
        return {cmd: CmdNames.MEXEC,
                subcmd: rrequired? 1 : 0,
                fn_name: name,
                nodeid: nodeid,
                taskid: taskid,
                oldid: "",
                args: params};
    }

    static createMachGetRes(name, nodeid, taskid) {
        return {cmd: CmdNames.GET_MEXEC_RES, fn_name: name, taskid, nodeid: nodeid, oldid: ""};
    }

    static createMachPutRes(taskid, nodeid, oldid, res_sig, res) {
        return {cmd: CmdNames.MEXEC_RES, taskid: taskid, nodeid: nodeid, oldid: oldid, fn_argsig: res_sig, args: [res]};
    }

    static createMachPutAck(taskid, nodeid, oldid, res) {
        return {cmd: CmdNames.MEXEC_ACK, taskid: taskid, nodeid: nodeid, oldid: oldid, args: [res]};
    }

    static createMachPutNak(taskid, nodeid, oldid, code) {
        return {cmd: CmdNames.MEXEC_NAK, taskid: taskid, nodeid: nodeid, oldid: oldid, args: [code]};
    }

    static createMachPutErr(taskid, nodeid, oldid, code) {
        return {cmd: CmdNames.MEXEC_ERR, taskid: taskid, nodeid: nodeid, oldid: oldid, args: [code]};
    }

    static createUnknownErr() {
        return {cmd: CmdNames.UNKNOWN};
    }

    /*
     * Methods used by the discovery schemes
     */
    static createHereIsCtrl(host, port) {
        var msg =  {cmd: CmdNames.HERE_IS_CTRL,
                    subcmd: 0,
                    fn_argsig: "si",
                    args: [host, port]};
        return msg;
    }

    static createFogAdditionPCFI(id, ip, port) {
        var tmsg = {cmd: CmdNames.PUT_CLOUD_FOG_INFO,
                    subcmd: CmdNames.FOG_ADD_INFO,
                    nodeid: id,
                    fn_argsig: "si",
                    args: [ip, port]};
        return tmsg;
    }

    static createFogDeletionPCFI(id) {
        return {cmd: CmdNames.PUT_CLOUD_FOG_INFO,
                subcmd: CmdNames.FOG_DEL_INFO,
                nodeid: id,
                fn_argsig: "",
                args: []};
    }

    static createFogDataDelInfo(id) {
        return {cmd: CmdNames.PUT_CLOUD_FOG_INFO,
                subcmd: CmdNames.FOG_DATA_DOWN,
                nodeid: id,
                fn_argsig: "",
                args: []}
    }

    static createFogDataAddInfo(id, dInfo) {
        console.log("FogDataAddInfo..........................", dInfo);
        return {cmd: CmdNames.PUT_CLOUD_FOG_INFO,
                subcmd: CmdNames.FOG_DATA_UP,
                nodeid: id,
                fn_argsig: "si",
                args: [dInfo.host, parseInt(dInfo.port)]}
    }

    static createCloudAdditionPCFI(id, ip, port) {
        return {cmd: CmdNames.PUT_CLOUD_FOG_INFO,
                subcmd: CmdNames.CLOUD_ADD_INFO,
                nodeid: id,
                fn_argsig: "si",
                args: [ip, port]};
    }

    static createCloudDeletionPCFI(id) {
        return {cmd: CmdNames.PUT_CLOUD_FOF_INFO,
                subcmd: CmdNames.CLOUD_DEL_INFO,
                nodeid: id,
                fn_argsig: "",
                args: []};
    }

    /*
     * No need to JSON.stringify(), because the message is in string format already.
     */
    static createPingReq() {
        return {cmd: CmdNames.PING};
    }
}

module.exports = JAMProtocol;
