'use strict';

const JAMDatastream = require('./jamdatastream.js');
const cmdParser = require('./cmdparser.js');

module.exports = class JAMDatasource {

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
		// ex. a[myapp].ns[global].ds[x]
		this.key = 'a[' + this.app + '].ns[' + this.namespace + '].dSource[' + this.name + ']';
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
    	if(typeof dev_id == 'string' || typeof dev_id == 'number') throw new TypeError('Input must be a string or a number');
    	var key = this.key + '.dStream[' + dev_id + ']';
    	return key;
    }

    /* a datasource is a collection of datastreams */
    addDatastream(dev_id){
    	if(this.type)
    	if(typeof dev_id == 'string' || typeof dev_id == 'number') throw new TypeError('Input must be a string or a number');
    	var key = this.buildKey(dev_id);
    	this[this.num_datastreams] = new JAMDatastream(dev_id, key, false, this.jammanager);
    	this.num_datastreams++;
    }

    // returns the number of datastreams associated with this datasource 
	numOfStream(){
		return this.length;
	}

	/* check if a specific datastream exists in this iopad 
	 * returns this datastream on success
	 */
	getDatastream(devId, key){
		for(var i=0;i<this.num_datastreams;i++){
			if(this[i].devId == devId && this[i].key == key) return this[i];
		}
		return -1;
	}

	/* add data to the specified datastream in this iopad */
	addDataToStream(data, devId, key){
		var datastream = this.getDatastream(devId, key);
		if(datastream == -1) return -1;
		data = {
			value: Number(data.log),
			timestamp: Date(data.time_stamp * 1000)
		};
		/* add data to the specified datastream */
		datastream.redis.rawCall(['zadd', key, data], function(e, response){ if(e) return -1; });
	}

	/* returns the last data pair (value, timestamp) in the specified datastream */
	lastDataInStream(devId, key){
		var datastream = this.getDatastream(devId, key);
		if(datastream == -1) return -1;
		else return datastream.lastData();
	}

	lastValueInStream(devId, key){
		var datastream = this.getDatastream(devId, key);
		if(datastream == -1) return -1;
		else return datastream.lastValue();
	}

	/* returns an array containing all (value, timestamp) pairs in the specified datastream in this iopad */
	dataInStream(devId, key){
		var datastream = this.getDatastream(devId, key);
		if(datastream == -1) return -1;
		else return datastream.data();
	}

	/* returns an array containing values of all (value, timestamp) pairs */
	valuesInStream(devId, key){
		var datastream = this.getDatastream(devId, key);
		if(datastream == -1) return -1;
		else return datastream.values();
	}

	/* returns an array containing the last n (value, timestamp) pairs in the specified datastream in this iopad */
	nDataInStream(n, devId, key){
		var datastream = this.getDatastream(devId, key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.nData(n);}
			catch(e){ return -1;}
		}
	}

	/* returns an array containing values of the last n values in the specified datastream in this iopad */
	nValuesInStream(n, devId, key){
		var datastream = this.getDatastream(devId, key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.nValues(n);}
			catch(e){ return -1;}
		}
	} 

	/* returns an array containing all (value, timestamp) pairs after a time point */
	dataAfterInStream(timestamp, devId, key){
		var datastream = this.getDatastream(devId, key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.dataAfter(timestamp);}
			catch(e){ return -1;}
		}
	}

	/* returns an array containing values of all (value, timestamp) pairs after a time point */
	valuesAfterInStream(timestamp, devId, key){
		var datastream = this.getDatastream(devId, key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.valuesAfter(timestamp);}
			catch(e){ return -1;}
		}
	}

	/* returns an array containing all (value, timestamp) pairs that come between two specified time points */
	dataBetweenInStream(fromTimestamp, toTimestamp, datastream){
		var datastream = this.getDatastream(devId, key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.dataBetween(fromTimestamp, toTimestamp);}
			catch(e){ return -1;}
		}
	}

	/* returns an array containing values of all (value, timestamp) come between two specified time points */
	valueBetweenInStream(fromTimestamp, toTimestamp, datastream){
		var datastream = this.getDatastream(devId, key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.valuesBetween(fromTimestamp, toTimestamp);}
			catch(e){ return -1;}
		}
	}
}