'use strict'
const JAMDatasource = require('./jamdatasource.js'),
	  Redis = require('redis-fast-driver'),
	  JAMLogger = require('./jamlogger.js'),
	  JAMManager = require('./jammanager.js'),
	  JAMFilter = require('./jamfilter.js'),
	  JAMTransformation = require('./jamtransformation.js');

var pub = new Redis({
    host: '127.0.0.1', //can be IP or hostname
    port: 6379
}),
	sub = new Redis({
    host: '127.0.0.1', //can be IP or hostname
    port: 6379
});

// an iopad provides a mechanism for sharing data between JAM apps
// an iopad is a collection of datasources
module.exports =  class JAMIopad extends JAMDatasource{

	// an iopad is a collection of datasources
	// an iopad has neither source nor destination
	constructor(jammanager, name){
		super(jammanager, 'iopad', name, undefined, undefined);
		this.datasources = {};
		pub.rawCall(['publish', this.key, "new iopad"], function(e, res){
			if(e) console.log('Error publishing to iopad',this.key);
			// if the iopad does not exist before
			// create one by subscribing to its channel
			else if(res==0){
				sub.rawCall(['subscribe', this.key], function(e, res){
					if(e) console.log("Error subscribing to iopad",this.key);
					else if(res[0]=='subscribe'){
						// subscribe this datasource to datastreans in all other datasources that are listening to this iopad
					}
					else if(res[0]=='message'){

					}
				});
			}
		});
		


	}

	// Public API 
	// all functions return -1 on fail

	// add a datasource to this iopad for sharing
	subscribe(dSource, f){
		// arguments type checking
		var type = dSource.constructor.name; 
		if(type!="JAMIopad" && type!="JAMLogger" && type!="JAMTransformation" && type!="JAMFilter" && type!="JAMBroadcaster") 
			throw new TypeError("dSource: expecting a jamdatasource");
		if(f !=undefined && typeof f!='function')
			throw new TypeError("f: expecting a function");

		// create a redis client for this datasource, which listens to this iopad
		var r = new Redis({
		    host: '127.0.0.1', //can be IP or hostname
		    port: 6379
		});

		// a datasource may subscribe to this iopad using different refresh_rate and/or f,
		// which will overwrite previous values
		this.datasources[dSource.key] = { ds:dSource, redis:r, f:f }; 

		var obj, stream;
		
		for(var key in this.datasources){
			obj = this.datasources[key]; 
			// subscribe every datasource on this iopad to every datastream in this datasource
			for(var i=0;i<dSource.num_datastreams;i++){
				stream = dSource[i];
				obj.redis.rawCall(['subscribe', stream.key], function(e, res){
					if(e) console.log("Error subscribing to datastream", stream.key);
					else if(res[0]=='message'){
						//if(obj.f) obj.f(JSON.parse(res[2]));
					}
				});					
			}
			// subscribe this datasource to every datastreams in previous datasources
			for(var i=0;i<obj.ds.num_datastreams;i++){
				stream = obj.ds[i];
				r.rawCall(['subscribe', stream.key], function(e, res){
					if(e) console.log("Error subscribing to datastream", stream.key);
					else if(res[0]=='message'){
						//if(f) f(JSON.parse(res[2]));
					}
				});
			}	
		}
		
		// every datastream in this datasource has to publish to its channel on change
		for(var i=0;i<dSource.num_datastreams;i++){
			stream = dSource[i];		//console.log(stream.key+'\n'+dSource.key);				
			stream.set_new_log_callback(function(res){
				// res is in the format of 'value$$$index$$$sequenceNum$$$timestamp'
				var arr = res.split(stream.delimiter),
					// format the message to be published
					response = {
						changed_datasource: dSource,
						changed_datastream: stream,
						new_data: { entry: arr[0], timestamp: arr[arr.length-1] }
					};
				pub.rawCall(["publish", stream.key, JSON.stringify(response)]);
			});
		}
	}
}