const   cbor = require('cbor-x'),
        CmdNames = require('./utils/constants').CmdNames,
        constants = require('./utils/constants'),
        udp = require('dgram');


function discoveryProcessor(cmdo) {
    let that = this;
    const multicast_addr = constants.multicast.Prefix + ".1";
    const rport = constants.multicast.sPort;
    const sport = constants.multicast.rPort;

    const listener = udp.createSocket({type:"udp4", reuseAddr:true}),
        sender = udp.createSocket({type:"udp4", reuseAddr:true});

    listener.bind(rport, multicast_addr, function() {
        listener.addMembership(multicast_addr);
        listener.setBroadcast(true);
    });

    listener.on("message", function (msg, err) {
        let qmsg = cbor.decode(msg);
        console.log("Qmsg ", qmsg);
        if (qmsg.cmd !== undefined) {
            switch (qmsg.cmd) {
                case CmdNames.WHERE_IS_CTRL:
                    let rmsg = {cmd: CmdNames.HERE_IS_CTRL};
                    let data = cbor.encode(rmsg);
                    console.log("============== Sending... ", rmsg, sport);
                    sender.send(data, 0, data.length, sport, multicast_addr);
                break;
                case CmdNames.PROBE_REGISTER:
                    if (qmsg.app === cmdo.app) {
                        that.jcore.startProbeManager(qmsg.port);
                        rmsg = {cmd: CmdNames.PROBE_ACK};
                        let data = cbor.encode(rmsg);
                        sender.send(data, 0, data.length, sport, multicast_addr);
                    }
                break;
            }
        }
    });
}

discoveryProcessor("")