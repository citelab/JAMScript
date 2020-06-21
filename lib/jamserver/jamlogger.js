'use strict';

const JAMDatasource = require('./jamdatasource.js');
//const jamsys = require('./jamsys');

class JAMLogger extends JAMDatasource {

    // name - logger name (string; optionally prefixed with namespace)
    // destination - dev, fog, or cloud
    constructor(jammanager, name, destination) {
        super(jammanager, 'logger', name, jammanager.getLevelCode(), destination || 'cloud');
    }
}

module.exports = JAMLogger;
