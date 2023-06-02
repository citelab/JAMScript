const cbor = require("cbor-x"),
  udp = require("dgram"),
  constants = require("../../constants/constants");

function getInput(prompt) {
  var readline = require("readline");

  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question(prompt, function (x) {
      rl.close();
      return resolve(x);
    });
  });
}

async function sendLoop(mqtt, app) {
  while (1) {
    inp = await getInput("Command (type 'help') ? ");
    var arr = inp.split(" ");
    switch (arr[0]) {
      case "help":
        console.log(
          "\nrexec loop|no-func args \nrexec-b loop|no-func args \nping \nregister-ack \nput-cinfo \n"
        );
        break;
      case "rexec":
        console.log("Remote exec command..");
        sendExecCommand(mqtt, app, arr[1], arr[2]);
        break;
      case "rexec-b":
        console.log("Remote exec command..");
        let seqnum = sendExecCommand(mqtt, app, arr[1], arr[2]);
        setTimeout(() => {
          setGetResults(mqtt, app, seqnum);
        }, 100);
        break;
      case "ping":
        console.log("Sending ping");
        sendPing(mqtt, app);
        break;
      case "register-ack":
        console.log("Sending register ack");
        sendRegisterAck(mqtt, app);
        break;
      case "put-cinfo":
        console.log("Putting cinfo");
        sendPutCloudInfo(mqtt, app);
        break;
    }
  }
}

function sendExecCommand(mqtt, app, tname, arg) {
  let rmsg = {
    cmd: constants.CmdNames.REXEC,
    fn_name: tname,
    params: arg,
    taskid: 1212,
  };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/requests/down", data);
}

function sendPing(mqtt, app) {
  let rmsg = { cmd: constants.CmdNames.PING };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/announce/down", data);
}

function sendRegisterAck(mqtt, app, registerId) {
  let rmsg = { cmd: constants.CmdNames.REGISTER_ACK, id: registerId };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/replies/down", data);
}

function sendPutCloudInfo(mqtt, app) {
  let rmsg = {
    cmd: constants.CmdNames.PUT_CLOUD_FOG_INFO,
    data: { ip: "127.0.0.1", port: 32232 },
  };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/replies/down", data);
}

function sendExecAck(mqtt, app, msg) {
  let rmsg = {
    cmd: constants.CmdNames.REXEC_ACK,
    taskid: msg.taskid,
    nodeid: msg.nodeid,
    data: 1000 * 10,
  };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/replies/down", data);
}

function sendExecErr(mqtt, app, msg) {
  let rmsg = { cmd: constants.CmdNames.REXEC_ERR, taskid: msg.taskid, code: 2 };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/replies/down", data);
}

function sendExecRes(mqtt, app, msg) {
  let rmsg = {
    cmd: constants.CmdNames.REXEC_RES,
    taskid: msg.taskid,
    res: 3432,
  };
  let data = cbor.encode(rmsg);
  mqtt.publish("/" + app + "/replies/down", data);
}

function discoveryServer(xport) {
  const multicast_addr = "224.1.1.1";
  const port = 35600;

  const listener = udp.createSocket({ type: "udp4", reuseAddr: true }),
    sender = udp.createSocket({ type: "udp4", reuseAddr: true });

  listener.bind(port, multicast_addr, function () {
    listener.addMembership(multicast_addr);
    listener.setBroadcast(true);
  });

  listener.on("message", function (msg, err) {
    qmsg = cbor.decode(msg);
    if (qmsg.cmd !== undefined) {
      switch (qmsg.cmd) {
        case constants.CmdNames.WHERE_IS_CTRL:
          let rmsg = {
            cmd: constants.CmdNames.HERE_IS_CTRL,
            tag: qmsg.tag,
            data: { ip: "127.0.0.1", port: xport },
          };
          let data = cbor.encode(rmsg);
          sender.send(data, 0, data.length, port, multicast_addr);
          console.log("Replied to a WHERE IS CONTROLLER query..");
          break;
      }
    }
  });
}

function mqttConnect(app, xport) {
  const copts = {
    clientId: "controller",
    keepalive: 10,
    clean: false,
    connectionTimeout: 10000,
  };
  var mqtt = require("mqtt");
  var sock = mqtt.connect("tcp://127.0.0.1:" + xport, copts);

  console.log("------------------------");
  sock.on("connect", function () {
    sock.subscribe("/" + app + "/requests/up");
    sock.subscribe("/" + app + "/replies/up");
    sock.subscribe("/" + app + "/replies/down");
  });
  sock.on("reconnect", function () {
    sock.subscribe("/" + app + "/requests/up");
    sock.subscribe("/" + app + "/replies/up");
    sock.subscribe("/" + app + "/replies/down");
  });
  return sock;
}

function mqttServer(app, mqtt) {
  mqtt.on("message", function (topic, buf) {
    let msg = cbor.decode(buf);
    switch (topic) {
      case "/" + app + "/requests/up":
        if (msg.cmd === constants.CmdNames.REGISTER)
          sendRegisterAck(mqtt, app, msg.id);
        else if (msg.cmd === constants.CmdNames.GET_CLOUD_FOG_INFO)
          sendPutCloudInfo(mqtt, app);
        else if (msg.cmd === constants.CmdNames.REXEC) {
          sendExecAck(mqtt, app, msg);
          setTimeout(() => {
            sendExecRes(mqtt, app, msg);
          }, 1000);
        } else if (msg.cmd === constants.CmdNames.GET_REXEC_RES) {
          if (msg.fn_name === "loop") sendExecRes(mqtt, app, msg);
          else sendExecErr(mqtt, app, msg);
        }
        break;
      case "/" + app + "/replies/up":
        console.log("Received a replies.. ?", msg);
        break;
    }
  });
}

const mqtt = mqttConnect("app-1", 3800);
// start the send loop
sendLoop(mqtt, "app-1");
// start the discovery server (UDP)
discoveryServer(3800);
// start the MQTT server
mqttServer("app-1", mqtt);
