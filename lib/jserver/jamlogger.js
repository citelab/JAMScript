'use strict';

const JAMDatasource = require('./jamdatasource.js');

class JAMLogger extends JAMDatasource {

    // name - logger name (string; optionally prefixed with namespace)
    // destination - dev, fog, or cloud
    constructor(jammanager, name, destination) {
        super(jammanager, 'logger', name, 'dev', destination);
    }

}

module.exports = JAMLogger;
