'use strict'

const JAMDatasource = require('./jamdatasource.js');

// an iopad provides a mechanism for sharing data between JAM apps
// an iopad is a collection of datasources
module.exports =  class JAMIopad extends JAMDatasource{

	// an iopad has neither source nor destination
	constructor(jammanager, name){
		super(jammanager, 'iopad', name, undefined, undefined);
	}

	// Public API 
	// all functions return -1 on fail

	// returns # datasources stored on this iopad 
	numSource(){
		return Object.keys(this).length;
	}

	// shows the keys of all the datasources stored in this iopad
	showDatasources(){
		this.map(function(elem){
			console.log(elem.key);
		});
	}

	// returns the datasource object with the specified key
	getDatasource(key){
		if(typeof key != 'string') throw new TypeError('Input must be a string');
		if(this[key] == undefined) return -1;
		return this[key];
	}

	// add a datasource onto this iopad
	addDatasources(datasource){
		if(this[datasource.key] != undefined){
			console.log('Datasource already exists');
			return -1;
		}
		this[datasource.key] = datasource;
	}

	// remove the datasource with the specified key from this iopad
	removeDatasource(key){
		if(this[key] == undefined){
			console.log('Datasource not found');
			return -1;
		}
		this[key] = undefined; 
	}


}