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
		this.numDatastream = 0;
		if(jammanager) jammanager.add_jamdatasource(this); 

		// parse the datasource name 
		var name  = name || 'name0',
			parts = name.split('.');
		if(parts.length === 2){
			this.namespace = parts[0];
			this.name = parts[1];
		}else{
			this.namespace = 'global';
			this.name = name;
		}
		// key is used to store this object in a redis client
		// ex. a[myapp].ns[global].dSource[myLogger]
		this.key = 'a[' + this.app + '].ns[' + this.namespace + '].dSource[' + this.name + ']';
	}

	// Public API 

	size(){
		return this.numDatastream;
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

    buildKey(devId){
    	if(typeof devId != 'string' && typeof devId != 'number') throw new TypeError('Input must be a string or a number');
    	// ex. a[myapp].ns[global].dSource[myLogger].dStream[dev2]
    	var key = this.key + '.dStream[' + devId + ']';
    	return key;
    }

    // a datasource is an array of datastreams 
    // the datastream is granted a key upon being added to this datasource
    addDatastream(devId){
    	if(typeof devId != 'string' && typeof devId != 'number') throw new TypeError('Input must be a string or a number');
    	var key = this.buildKey(devId);
    	this[this.numDatastream] = new JAMDatastream(devId, key, false, this.jammanager);
    	this.numDatastream++;
    }

/*
    // remove the datasource with the specified key from this iopad
    // a datasource a javascript object or an array?
	removeDatasource(key){
		var datastream = this.getDatastream(key);
		if(datastream == -1) return -1;
	}
*/

    // returns the number of datastreams associated with this datasource 
	numOfStream(){
		return this.length;
	}

	// check if a datastream exists in this datasource
	// returns this datastream if found
	getDatastream(key){
		for(var i=0;i<this.numDatastream;i++){
			if(this[i].key == key) return this[i];
		}
		return -1;
	}

	// prints all data pairs in the datastream specified
	// if key is undefined then prints all data pairs in all the datastreams
	showData(key){
		// prints all data pairs in the datastream specified
		var helper = function(datastream){
			var arr = dataInStream(datastream.key);
			if(arr == -1) return -1;
			arr.forEach(function(data){
				data = {
					value: new Number(pair.log),
					timestamp: new Date(pair.timestamp*1000)
				};
				console.log(data);
			});
		};

		if(typeof key == "undefined"){
			this.forEach(helper(datastream));
		}else if(typeof key != "string") throw new TypeError("input must be a string");
		helper(datastream);
	}

	// add data to the specified datastream in this iopad 
	addDataToStream(data, key){
		var datastream = this.getDatastream(key);
		if(datastream == -1) return -1;
		data = {
			value: Number(data.log),
			timestamp: Date(data.time_stamp*1000)
		};
		// add data to the specified datastream
		datastream.redis.rawCall(['zadd', key, data], function(e, response){ if(e) return -1; });
	}

	// returns the last data pair in the specified datastream 
	lastDataInStream(key){
		var datastream = this.getDatastream(key);
		if(datastream == -1) return -1;
		else return datastream.lastData();
	}

	// returns the value of the last data pair in the specified datastream
	lastValueInStream(key){
		var datastream = this.getDatastream(key);
		if(datastream == -1) return -1;
		else return datastream.lastValue();
	}

	// returns an array containing all (value, timestamp) pairs in the specified datastream in this iopad 
	dataInStream(key){
		var datastream = this.getDatastream(key);
		if(datastream == -1) return -1;
		else return datastream.data();
	}

	// returns an array containing values of all data pairs 
	valuesInStream(key){
		var datastream = this.getDatastream(key);
		if(datastream == -1) return -1;
		else return datastream.values();
	}

	// returns an array containing the last n data pairs in the specified datastream in this iopad 
	nDataInStream(n, key){
		var datastream = this.getDatastream(key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.nData(n);}
			catch(e){ return -1;}
		}
	}

	// returns an array containing values of the last n values in the specified datastream in this iopad
	nValuesInStream(n, key){
		var datastream = this.getDatastream(key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.nValues(n);}
			catch(e){ return -1;}
		}
	} 

	// returns an array containing all (value, timestamp) pairs after a time point 
	dataAfterInStream(timestamp, key){
		var datastream = this.getDatastream(key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.dataAfter(timestamp);}
			catch(e){ return -1;}
		}
	}

	//returns an array containing values of all (value, timestamp) pairs after a time point 
	valuesAfterInStream(timestamp, key){
		var datastream = this.getDatastream(key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.valuesAfter(timestamp);}
			catch(e){ return -1;}
		}
	}

	// returns an array containing all (value, timestamp) pairs that come between two specified time points 
	dataBetweenInStream(fromTimestamp, toTimestamp, key){
		var datastream = this.getDatastream(key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.dataBetween(fromTimestamp, toTimestamp);}
			catch(e){ return -1;}
		}
	}

	// returns an array containing values of all (value, timestamp) come between two specified time points 
	valueBetweenInStream(fromTimestamp, toTimestamp, key){
		var datastream = this.getDatastream(key);
		if(datastream == -1) return -1;
		else{
			try{ datastream.valuesBetween(fromTimestamp, toTimestamp);}
			catch(e){ return -1;}
		}
	}
}