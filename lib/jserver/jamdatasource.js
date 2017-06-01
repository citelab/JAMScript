'use strict';
const Redis = require("redis-fast-driver");

const JAMDatastream = require('./jamdatastream.js');
//const cmdParser = require('./cmdparser.js');

class JAMDatasource {

    // type - data source type (string; logger, filter, or transformation)
    // name - data source name (string; optionally prefixed with namespace)
    // source - dev, fog, or cloud
    // destination - dev, fog, or cloud
    constructor(jammanager, type, name, source, destination) {
        this.jammanager = jammanager;
        this.type = type;
        this.source = source;
        this.destination = destination;
        this.app = cmdParser().app || 'DEFAULT_APP';

        // name and namespace
        var name = name || 'name0';
        var parts = name.split('.');
        if (parts.length === 2) {
            this.namespace = parts[0];
            this.name = parts[1];
        } else {
            this.namespace = 'global';
            this.name = name;
        }
        
        this.redis = new Redis({
		    host: '127.0.0.1', 
		    port: 6379
		});
        // datastreams
        this.num_datastreams = 0;

        this.key = 'a[' + this.app + '].ns[' + this.namespace + '].dSources[' + this.name + ']';
        if (jammanager) {
            jammanager.add_jamdatasource(this);
        }
    }

    // public API

    /*
     size()
     Returns the number of data streams in a data source (logger, filter, or transformation).
     Example:
     jdata {
        double x as logger;
    }
    console.log(x.size()); // logger x contains 3 data streams (from 3 devices)
    3
    */
    size() {
        return this.num_datastreams;
    }

    // internal implementation

    getApp() {
        return this.app;
    }

    getDeviceId() {
        return this.dev_id;
    }

    getNamespace() {
        return this.namespace;
    }

    getName() {
        return this.name;
    }

    getType() {
        return this.type;
    }

    addDatastream(dev_id) {
        var key = this.buildKey(dev_id);
        this[this.num_datastreams] = new JAMDatastream(dev_id, key, false, this.jammanager);
        this.num_datastreams++;
        return this[this.num_datastreams-1];
    }

    buildKey(dev_id) {
        var key = 'a[' + this.app + '].' +
            'ns[' + this.namespace + '].' +
            'dSources[' + this.name + '].' +
            'dStreams[' + dev_id + ']';
        return key;
    }

}

module.exports = JAMDatasource;