'use strict';

const JAMDatastream = require('./jamdatastream.js');
const cmdParser = require('./cmdparser.js');

class JAMDatasource {

	/* type - data source type (string; logger, filter, or transformation)
	 * name - data source name (string; optionally prefixed with namespace)
	 * source - dev, fog, or cloud
	 * destination - dev, fog, or cloud
	 */
	constructor(jammanager, type, name, source, destination){
		this.jammanager  = jammanager;
		this.type        = type;
		this.source      = source;
		this.destination = destination;
		this.app         = cmdParser().app || 'DEFAULT_APP';
		this.num_datastreams = 0;
		if(jammanager) jammanager.add_jamdatasource(this); 

		/* parse the datasource name */
		var name  = name || 'name0',
			parts = name.split('.');
		if(parts.length === 2){
			this.namespace = parts[0];
			this.name = parts[1];
		}else{
			this.namespace = 'global';
			this.name = name;
		}
		this.key = 'apps[' + this.app + '].namespace[' + this.namespace + '].datasource[' + this.name + ']';
	}

	/* Public API */
	size(){
		return this.num_datastreams;
	}
	getApp(){
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

    buildKey(dev_id){
    	var key = this.key + '.datastream[' + dev_id + ']';
    	return key;
    }

    /* a datasource is a collection of datastreams */
    addDatastream(dev_id){
    	var key = this.buildKey(dev_id);
    	this[this.num_datastreams] = new JAMDatastream(dev_id, key, false, this.jammanager);
    	this.num_datastreams++;
    }
}
module.exports = JAMDatasource;