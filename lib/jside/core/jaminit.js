'use strict'
const	cmdOpts = require('../utils/cmdparser'),
        deviceParams = require('../utils/deviceparams').init(cmdOpts.port),
		logger = require('../utils/jerrlog'),
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
            // FIXME: this logger is not used. we need to use it or remove it..
            logger.init(cmdOpts.app, false);
            that.reggie = new Registrar(cmdOpts.app, machType, deviceParams.getItem('deviceId'),
            cmdOpts.port, {long: cmdOpts.long, lat: cmdOpts.lat}, { protocols: cmdOpts.protocols });
            jamSys.init(that.reggie, machType, cmdOpts.tags, deviceParams.getItem('deviceId'),
                    cmdOpts.link, cmdOpts.long, cmdOpts.lat);
            jamSys.setMQTT(helper.getMachineAddr(), cmdOpts.port);
            resolve(jamSys);
        });
    }
    return this;
}
