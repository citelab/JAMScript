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
		this.key = 'apps[' + this.app + '].namespace[' + this.namespace + '].fromDevice[' + this.name + ']';
	}

	/* Public API */
	size(){
		return this.num_datastreams;
	}
	getApp(){
		return this.app;
	}
	getDeviceId() {
        return this.devId;
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

    buildKey(devId, key){
    	if(typeof devId != 'string' && typeof devId != 'number') throw new TypeError('Input must be a string or a number');
    	if(key == undefined) return this.key + '.fromDevice[' + devId + ']';
    	else if(typeof key != 'string' && typeof key != 'number') throw new TypeError('Input must be a string or a number');
    	return this.key + '.fromDevice[' + devId + ']' + '.key[' + key + ']';
    }

    /* a datasource maintains multiple datastreams, each of which further contains datastreams from the same device */
    addDatastream(devId, key){
    	if((typeof devId != 'string' && typeof devId != 'number') || (typeof key != 'string' && typeof key != 'number')) 
    		throw new TypeError('Inputs must be strings or a numbers');
    	/* if no datastream from this device is stored in this datasource
    	 * create one collection of datastreams with device_key as its key
    	 */ 
    	if(this[devId] == undefined) this[devId] = {};
    	this[devId][key] = new JAMDatastream(devId, key, this.jammanager);
    	/* below will be used for users to manipulate data in redis */
    	this[devId][key].device_key = this.buildKey(devId),			// name of the collection of datastreams from the device specified by devId
    	this[devId][key].stream_key = this.buildKey(devId, key);	// name of the datastream
    	/* add this datastream to the redis */

    }

    /* newly implemented public API */

    /* returns the number of datastreams on this iopad */
	numOfStream(){
		return Object.keys(this).length;
	}

	/* returns undefined is this datastream doesn't exist */
	getDatastream(devId, key){
		return this[devId][key];
	}

	/* add data to the specified datastream in this iopad */
	addDataToStream(data, devId, key){
		var datastream = this.getDatastream(devId, key);
		if(datastream == undefined){
			console.log('adding new datastream');
			try{ this.addDatastream(devId, key);}
			catch(e){return -1;}
		}
		data = {
			value: Number(data.log),
			timestamp: Date(data.timestamp * 1000)
		};
		/* add data to the specified datastream */
		datastream.redis.rawCall(['zadd', datastream.stream_key, data], function(e, response){ if(e) return -1; });
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