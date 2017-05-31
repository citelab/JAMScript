'use strict'
const JAMDatasource = require('./jamdatasource.js'),
	  Redis = require('redis-fast-driver'),
	  JAMLogger = require('./jamlogger.js'),
	  JAMManager = require('./jammanager.js'),
	  JAMFilter = require('./jamfilter.js'),
	  JAMTransformation = require('./jamtransformation.js');

var r = new Redis({
    host: '127.0.0.1', //can be IP or hostname
    port: 6379
});

// an iopad provides a mechanism for sharing data between JAM apps
// an iopad is a collection of datasources
module.exports = class JAMIopad extends JAMDatasource{

	// an iopad is a collection of datasources
	// an iopad has neither source nor destination
	constructor(jammanager, name){
		super(jammanager, 'iopad', name, undefined, undefined);
		this.datasources = {};
		this.pub = new Redis({
		    host: '127.0.0.1', //can be IP or hostname
		    port: 6379
		});
		this.sub = new Redis({
		    host: '127.0.0.1', //can be IP or hostname
		    port: 6379
		});
	}

	// Public API 
	// all functions return -1 on fail

	static getIopad(key, f){
		// subscribe to the iopad with the key specified 
		r.rawCall(['subscribe', key], function(e, res){
			if(e) console.log("Error subscribing to iopad",key);
			else if(res[0]=='message'){
				if(f) f(JSON.parse(res[2]));
			}
		});
	}

	// add a datasource to this iopad for sharing
	subscribe(dSource){
		// arguments type checking
		var type = dSource.constructor.name; 
		if(type!="JAMIopad" && type!="JAMLogger" && type!="JAMTransformation" && type!="JAMFilter" && type!="JAMBroadcaster") 
			throw new TypeError("dSource: expecting a jamdatasource");

		// every datastream in this datasource has to publish to its channel on change
		var stream, that=this;
		for(var i=0;i<dSource.num_datastreams;i++){
			stream = dSource[i];
			// subscribe this iopad to the channel of dSource's datastreams
			that.sub.rawCall(['subscribe', stream.key], function(e, res){
				if(e) console.log("Error subscribing to datasource", dSource.key);
				else if(res[0] == 'message') that.pub.rawCall(['publish', that.key, res[2]]);
			});
			
			stream.set_new_log_callback(function(res){
				// res is in the format of 'value$$$index$$$sequenceNum$$$timestamp'
				var arr = res.split(stream.delimiter),
					// format the message to be published
					response = {
						changed_datasource: dSource,
						changed_datastream: stream,
						new_data: { entry: arr[0], timestamp: arr[arr.length-1] }
					};
				that.pub.rawCall(["publish", stream.key, JSON.stringify(response)]);
			});
		}
	}
}