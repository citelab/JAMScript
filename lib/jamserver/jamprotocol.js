'use strict';

var cbor = require('cbor'),
    crypto = require('crypto');
    crypto = require('crypto');

// =============================================================================
// JAMProtocol class.
// This class contains static methods for the key protocols
// =============================================================================

class JAMProtocol {

    // msg contains the request we received.. returning a reply!
    static sendMachAcknowledge(serv, app, msg) {

        if (msg['cmd'] === 'MEXEC-ASY')
            msg['opt'] = 'ASY';

        msg['cmd'] = 'MEXEC-ACK';
        serv.publish('/' + app + '/mach/func/reply', cbor.encode(msg));
    }

    static createMachAsyncReq(name, params, oexpr, vec, machtype, bclock) {

        var tmsg = {"cmd": "MEXEC-ASY",
                    "opt": machtype.toUpperCase(),
                    "cond": oexpr,
                    "condvec": vec,
                    "actname": name,
                    "actid": "-",
                    "actarg": bclock,
                    "args": params};

        tmsg.actid = crypto.createHash('md5').update(JSON.stringify(tmsg) + new Date()).digest('hex');
        return tmsg;
    }

    static createRemoteSyncReq(name, params, expr, vec, machtype, bclock, scount) {

        var tmsg = {"cmd": "REXEC-SYN",
                    "opt": machtype.toUpperCase(),
                    "cond": processExpr(expr),
                    "condvec": vec,
                    "actname": name,
                    "actid": "-",
                    "actarg": bclock,
                    "args": params};
        tmsg.actid = crypto.createHash('md5').update(JSON.stringify(tmsg) + scount).digest('hex');

        return tmsg;
    }

    static createRemoteSyncReqQ(name, params, expr, vec, machtype, bclock, scount) {

        var tmsg = {"cmd": "REXEC-SYN",
                    "opt": machtype.toUpperCase(),
                    "cond": processExpr(expr),
                    "condvec": vec,
                    "actname": name,
                    "actid": "-",
                    "actarg": bclock,
                    "args": params};
        tmsg.actid = crypto.createHash('md5').update(JSON.stringify(tmsg) + scount).digest('hex');
        tmsg.cmd = "REXEC-INQ";

        return tmsg;
    }

    static createRemoteAsyncReq(name, params, expr, vec, machtype, bclock, acount) {

        var tmsg = {"cmd": "REXEC-ASY",
                    "opt": machtype.toUpperCase(),
                    "cond": processExpr(expr),
                    "condvec": vec,
                    "actname": name,
                    "actid": "-",
                    "actarg": bclock,
                    "args": params};

        tmsg.actid = crypto.createHash('md5').update(JSON.stringify(tmsg) + acount).digest('hex');

        return tmsg;
    }

    static createMachSyncReq(name, params, oexpr, vec, machtype, bclock) {

        var tmsg = {"cmd": "MEXEC-SYN",
                    "opt": machtype.toUpperCase(),
                    "cond": oexpr,
                    "condvec": vec,
                    "actname": name,
                    "actid": "-",
                    "actarg": bclock,
                    "args": params};

        tmsg.actid = crypto.createHash('md5').update(JSON.stringify(tmsg) + new Date()).digest('hex');
        return tmsg;
    }
}



function processExpr2(expr) {

    var earr = expr.split("&&");
    if (earr.length == 1)
        return eval(earr[0]);
    else {
        var res = [];
        earr.foreach(function(t) {
            res.push(eval(t));
        })
        return res.join("&&");
    }
}

function processExpr(expr) {

    // This is what the compiler is putting in by default... pass it along!
    if (expr === "true")
        return expr;

    var earr = expr.split("||");
    if (earr.length == 1)
        return processExpr2(earr[0]);
    else {
        var res = [];
        earr.foreach(function(t) {
            res.push(processExpr2(t));
        })
        return res.join("||");
    }
}



module.exports = JAMProtocol;
