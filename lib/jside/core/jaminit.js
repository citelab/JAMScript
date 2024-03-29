'use strict'
const	cmdOpts = require('../utils/cmdparser'),
        deviceParams = require('../utils/deviceparams').init(cmdOpts.port),
		Registrar = require('../jdiscovery'),
		jamSys = require('./jamsys'),
		helper = require('../utils/helper'),
        constants = require('../utils/constants');

module.exports = new function()
{

    this.run = function() {
        var that = this;
        return new Promise(function(resolve, reject) {
            let machType = helper.getMachineType(cmdOpts);
            deviceParams.setItem('machType', machType);

            let nodeId = deviceParams.getItem('deviceId');

            that.reggie = new Registrar(
                cmdOpts.app, 
                machType, 
                nodeId,
                cmdOpts.port, 
                {long: cmdOpts.long, lat: cmdOpts.lat}, 
                { protocols: cmdOpts.protocols, localregistryhost: cmdOpts.localregistryhost},
                `mqtt://127.0.0.1:${cmdOpts.port}`,
            );
            that.reggie.discoverAttributes({
                fog: {
                    curLoc: {
                        onAdd: 'new-loc',
                        onRemove: 'loc-removed'
                    }
                }
            });

            jamSys.init(that.reggie, cmdOpts.app, machType, cmdOpts.tags, deviceParams.getItem('deviceId'),
                    cmdOpts.edge, cmdOpts.long, cmdOpts.lat);
            jamSys.setMQTT(helper.getMachineAddr(), cmdOpts.port);
            jamSys.setRedis(cmdOpts.redhost, cmdOpts.redport);
            resolve(jamSys);
        });
    }
    return this;
}
