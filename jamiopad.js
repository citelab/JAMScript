'use strict'

const JAMDatasource = require('./jamdatasource.js');

// an iopad provides a mechanism for sharing data between JAM apps
// an iopad is a collection of datasources
module.exports =  class JAMIopad extends JAMDatasource{

	// an iopad is a collection of datasources
	// an iopad has neither source nor destination
	constructor(jammanager, name){
		super(jammanager, 'iopad', name, undefined, undefined);
		this.datasource = [];
		this.numDatasource = 0;
	}

	// Public API 
	// all functions return -1 on fail

	// share the specified datasource on this iopad by
	// adding datastreams in it to this iopad
	addDatasource(datasource){
		if(datasource.constructor.name != "JAMDatasource") throw new TypeError("input must be a jamdatasource");
		datasource.data_values.forEach(function(datastream){
			this[numDatastream] = datastream;
			numDatastream++;
		});
		this.datasource[numDatasource] = datasource;
		numDatasource++;
	}

	// returns the datasource with the specified key
	// returns -1 if it doesn't exist
	getDatasource(key){
		if(typeof key != "string") throw new TypeError("input must be a string");
		for(var i=0;i<numDatasource;i++){
			if(this.datasource[i].key == key) return this.datasource[i];
		}
		return -1;
	}

/*
	// removes the datasource with the specified key
	removeDatasource(key){
		if(typeof key != "string") throw new TypeError("input must be a string");
		for(var i=0;i<numDatasource;i++){
			if(this.datasource[i].key == key) return this.datasource[i];
		}
		return -1;
	}
*/
}