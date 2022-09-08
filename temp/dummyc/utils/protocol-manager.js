// ----------------------------------------------------
// ---------------------IMPORTS------------------------
// ----------------------------------------------------
const logger = require("./logger");
const constants = require("../constants/constants");
const cbor = require("cbor-x");

// ----------------------------------------------------
// ---------------------PROTOCOLS----------------------
// ----------------------------------------------------
function sendExecCommand(mqtt, app, taskId, nodeId, taskName, arg) {
  const cmd = constants.CmdNames.REXEC;
  let rmsg = {
    cmd: cmd,
    fn_name: taskName,
    params: arg,
    taskid: taskId,
    nodeid: nodeId
  };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/requests/up", data);
  logger.log(
    "REXEC",
    `Published REXEC request -> cmd:${cmd} fn_name:${taskName} params:${arg} taskid:${taskId} nodeid:${nodeId}`
  );
  return taskId;
}

function sendExecAck(mqtt, app, msg) {
  const cmd = constants.CmdNames.REXEC_ACK;
  const taskId = msg.taskid;
  let rmsg = { cmd: cmd, taskid: taskId };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/replies/up", data);
  logger.log(
    "REXEC_ACK",
    `Sent exec acknowledgement -> cmd:${cmd}, taskid:${taskId}`
  );
}

function sendExecErr(mqtt, app, msg, errorCode) {
  const cmd = constants.CmdNames.REXEC_ERR;
  const taskId = msg.taskid;
  let rmsg = {
    cmd: cmd,
    taskid: taskId,
    code: errorCode,
  };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/replies/up", data);
  logger.log(
    "REXEC_ERR",
    `Reported errors for REXEC -> cmd:${cmd} taskid:${taskId} code:${errorCode}`
  );
}

function sendExecRes(mqtt, app, msg, result) {
  const cmd = constants.CmdNames.REXEC_RES;
  const taskId = msg.taskid;
  let rmsg = {
    cmd: cmd,
    taskid: taskId,
    res: result,
  };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/replies/up", data);
  logger.log(
    "REXEC_RES",
    `Uploaded REXEC results -> cmd:${cmd} taskid:${taskId} res:${result}`
  );
}

function sendGetResults(mqtt, app, seqnum) {
  const cmd = constants.CmdNames.GET_REXEC_RES;
  let rmsg = { cmd: cmd, taskid: seqnum };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/requests/up", data);
  logger.log(
    "GET_REXEC_RES",
    `Requested REXEC results -> cmd:${cmd} taskid:${seqnum}`
  );
}

function sendPong(mqtt, app) {
  const cmd = constants.CmdNames.PONG;
  let rmsg = { cmd: cmd };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/replies/up", data);
  logger.log("PONG", `Replied PONG to PING requests -> cmd:${cmd}`);
}

function sendRegister(mqtt, registerId, app) {
  const cmd = constants.CmdNames.REGISTER;
  let rmsg = { cmd: cmd, id: registerId };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/requests/up", data);
  logger.log("REGISTER", `Send the register -> cmd:${cmd} id:${registerId}`);
}

function sendGetCloudInfo(mqtt, registerId, app) {
  const cmd = constants.CmdNames.GET_CLOUD_FOG_INFO;
  let rmsg = {
    cmd: cmd,
    id: registerId,
    version: 2,
  };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/requests/up", data);
  logger.log(
    "GET_CLOUD_FOG_INFO",
    `Requested cloud and fog info -> cmd:${cmd} id:${registerId}`
  );
}

// ----------------------------------------------------
// ----------------------EXPORTS-----------------------
// ----------------------------------------------------
module.exports = Object.freeze({
  sendExecCommand: sendExecCommand,
  sendExecAck: sendExecAck,
  sendExecErr: sendExecErr,
  sendExecRes: sendExecRes,
  sendGetResults: sendGetResults,
  sendPong: sendPong,
  sendRegister: sendRegister,
  sendGetCloudInfo: sendGetCloudInfo,
});
