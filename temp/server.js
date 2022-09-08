var cmdOpts = require('../utils/cmdparser'),
    deviceParams = require('../utils/deviceparams').init(cmdOpts.port),
    helper = require('../utils/helper');

var addr = helper.getMachineAddr();
console.log(addr);
var mq = helper.mqttConnect(addr, cmdOpts.port);
//var mq = helper.mqttConnect(addr, 5883);
//console.log(mq);

