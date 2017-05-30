'use strict'
const JAMDatasource = require('./jamdatasource.js'),
	  Redis = require('redis-fast-driver');

var pub = new Redis({
    host: '127.0.0.1', //can be IP or hostname
    port: 6379
}),
	sub = new Redis({
    host: '127.0.0.1', 
    port: 6379
});

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

	// returns the datasource with the specified key
	// returns -1 if it doesn't exist
	getDatasource(key, f){
		// f has to be a function that wrapped in the JSON object format
		// ex. { var myFunc = function(){...} }
		if(typeof key != "string") throw new TypeError("key must be a string");
		var funcString = undefined;
		if(f) funcString = this.serializeFunc(f);
		pub.rawCall(['publish', key, "return"+","+funcString]);
	}

	// serialize a function
	serializeFunc(f){
		// f has to be a function that wrapped in the JSON object format
		// ex. { var myFunc = function(){...} }
		return JSON.stringify(f, function(key, value){
			if (typeof(value) === 'function') return value.toString();
			return value;
		});
	}

	// deserialize a function
	deserializeFunc(funcString){
		var restoredFunc = JSON.parse(funcString, function(key, value){
			if (key === "") return value;	    
		    if (typeof value === 'string') {
		        var rfunc = /function[^\(]*\(([^\)]*)\)[^\{]*{([^\}]*)\}/,
		            match = value.match(rfunc);
		        if (match) {
		            var args = match[1].split(',').map(function(arg) { return arg.replace(/\s+/, ''); });
		            return new Function(args, match[2]);
		        }
		    }
		    return value;
		});
		return restoredFunc;
	}

	// add a datasource to this iopad for sharing
	addDatasource(datasource){
		// type checking
		var type = datasource.constructor.name; 
		if(type!="JAMIopad" && type!="JAMLogger" && type!="JAMTransformation" && type!="JAMFilter" && type!="JAMBroadcaster") 
			throw new TypeError("input must be a jamdatasource");
		// check if this datasource already exists on this iopad
		for(var i=0;i<this.numDatasource;i++){
			if(this.datasource[i].key == datasource.key){
				console.log("This datasource already exists");
				return -1;
			}
		}
		this.datasource[this.numDatasource] = datasource;
		this.numDatasource++;
		var that = this;

		// subscribe to this datasource
		sub.rawCall(["subscribe", datasource.key], function(e, res){
			if(e) console.log("error subscribing to datasource");
			// res is in the format of ["message", channelName, msgContent]
			else if(res[0]=='message'){
				// split the request
				// the request is in the form of "return,callback"
				var req = res[2].split(",");
				// handle messages demanding a datasource
				if(req[0]=="return"){
					//console.log("return a datasource");
					// find the specified datasource
					for(var i=0;i<that.numDatasource;i++){
						if(that.datasource[i].key == res[1]){
							// subscribe to receiving the requested data
							sub.rawCall(["subscribe", res[1]+'.response'], function(e, res){
								if(e) console.log("error subscribing to datasource response");
								else if(res[0]=='message'){
									if(req[1]){
										var restoredFunc = that.deserializeFunc(req[1]);
										restoredFunc[Object.keys(restoredFunc)[0]](JSON.parse(res[2]));
									}
									//else console.log("processData has to be defined");
								}
								//else console.log(res);
							});
							// publish the requested data to the receiving channel
							pub.rawCall(['publish', res[1]+'.response', JSON.stringify(that.datasource[i])]);
						}
					}
				}
			}
			//else if(res[0]=='subscribe') console.log(res);
			//else console.log("Haven't implemented...");
		});
	}
}