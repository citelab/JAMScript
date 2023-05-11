'use strict'
const	cmdOpts = require('../utils/cmdparser'),
        deviceParams = require('../utils/deviceparams').init(cmdOpts.port),
		Registrar = require('../jdiscovery'),
		jamSys = require('./jamsys'),
		helper = require('../utils/helper');

module.exports = new function()
{
    
    this.run = function() {
        var that = this;
        return new Promise(function(resolve, reject) {
            let machType = helper.getMachineType(cmdOpts);
            deviceParams.setItem('machType', machType);
            that.reggie = new Registrar(cmdOpts.app, machType, deviceParams.getItem('deviceId'),
            cmdOpts.port, {long: cmdOpts.long, lat: cmdOpts.lat}, { protocols: cmdOpts.protocols });
            jamSys.init(that.reggie, machType, cmdOpts.tags, deviceParams.getItem('deviceId'),
                    cmdOpts.edge, cmdOpts.long, cmdOpts.lat);
            jamSys.setMQTT(helper.getMachineAddr(), cmdOpts.port);
            jamSys.setRedis(cmdOpts.redhost, cmdOpts.redport);
            resolve(jamSys);
        });
    }
    return this;
}
