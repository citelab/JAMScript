var Redis = require('redis-fast-driver');

// var r = new Redis({
// 	host: '127.0.0.1',
// 	port: 6379
// });

// var r2 = new Redis({
// 	host: '127.0.0.1',
// 	port: 6379
// });


var JLogger = function(key, slots, redis){
	this.key = key + '';
	this.sequenceNumber = 0;
	this.delimeter = "$$$";
	this.space = slots && slots > 0 ? parseInt(slots) : -1;//the amount of entries to store
	this.logger = [];
	this.redis = redis ? redis : new Redis({
		host: '127.0.0.1',
		port: 6379
	});

	//register for key events
	this.registerForKeyEvents();
};

JLogger.prototype = {
	registerForKeyEvents: function(){
		// var self = this, fromStamp;

		// r2.rawCall(['psubscribe', '__keyspace@*:' + this.key], function(e, data){
		// 	if( e )
		// 		console.log('RECEIVE-ERROR', e);
		// 	else
		// 		console.log('RECEIVED', data);
        //
		// 	if( data[data.length - 1] == "zadd" ) {
		// 		fromStamp = 0;
        //
		// 		if( self.logger.length > 0 )
		// 			fromStamp = self.logger[self.logger.length - 1].timestamp + 1;
        //
		// 		//get the last set of entries from the data store and cache them
		// 		//add 1 to offset the millisecond so that the last one we already have would not be retrieved
		// 		self.getSeries(function (resp) {
		// 			if (resp.status) {
		// 				resp.data.forEach(function (obj) {
		// 					self.logger.push(obj);
		// 				});
		// 			}
		// 			else
		// 				console.log("ERROR", resp.error);
		// 		}, fromStamp + '', 'inf');
		// 	}
		// });
	},
	zrange: function( key, start, range, callback){
	this.redis.rawCall(['ZRANGE', key, start, range], callback);
	},
	log: function(entry, callback){
		//var timestamp = new Date().getTime();
		var self = this;

		//send to Redis
		// r.rawCall(['ZADD', this.key, timestamp, entry + this.delimeter + (this.sequenceNumber++)], function(e){
		// 	if (e) {
		// 		if (callback)
		// 			callback({status: false, error: e});
		// 	}
		// 	else {
		// 		if (callback)
		// 			setTimeout(callback({status: true, message: 'Data added!'}), 0);
        //
		// 		self.logger.push({entry: entry, timestamp: timestamp});
        //
		// 		//if addition was successful, we need to run a command to remove all previous data if
		// 		//the amount of entries to store was set and we have exceeded the maximum set number of entries allowed
		// 		if (self.space > 0 && self.logger.length > self.space) {
		// 			amount = self.logger.length - self.space;
		// 			from = self.logger[0].timestamp;
		// 			to = self.logger[amount - 1].timestamp;
        //
		// 			r.rawCall(['ZREMRANGEBYSCORE', self.key, from, to], function (e) {
		// 				if (e)
		// 					console.log("ERROR", resp.error);
		// 				else
		// 					self.logger.splice(0, amount);
		// 			});
		// 		}
		// 	}
        //
		// });

		//process changed from the above execution
		//the timestamp would come from the redis server
		//this new method executes a LUA script on the redis server and returns the timestamp relative to the server

		this.redis.rawCall(["EVAL", "redis.replicate_commands(); local t = (redis.call('TIME'))[1]; redis.call('ZADD', KEYS[1], t, ARGV[1]); return {t}", 1, this.key, entry + this.delimeter + (this.sequenceNumber++)], function(e, d){
			if( e ){
				if( callback )
					callback({status: false, error: e});
			}
			else{
				self.logger.push({entry: entry, timestamp: d[0] - 0});//convert the returned timestamp to a number
				if( callback )
					setTimeout(function(){
						callback({status: true, message: 'Data added!', timestamp: d[0] - 0});
					}, 0);

				//if addition was successful, we need to run a command to remove all previous data if
				//the amount of entries to store was set and we have exceeded the maximum set number of entries allowed
				self.performDataRegularization();
			}
		});
	},
	getSeries: function(callback, fromMillis, toMillis) {//TODO needs to be revised cause of the data caching
		var fr, to, command, i, data = [], self = this, slice;

		// if( fromMillis && toMillis ){
		// 	command = 'ZRANGEBYSCORE';
		// 	fr = fromMillis;
		// 	to = toMillis;
		// }
		// else{
		// 	command = 'ZRANGE';
		// 	fr = 0;
		// 	to = -1;
		// }
		//
		// this.redis.rawCall([command, this.key, fr, to, 'WITHSCORES'], function(e, d){
		// 	if( e )
		// 		callback({status: false, error: e});
		// 	else{
		// 		//build the returned data to JSON format
		// 		for(i = 0; i < d.length; i+=2)
		// 			data.push({entry: d[i].split(self.delimeter)[0], timestamp: d[i + 1]});
		//
		// 		callback({status: true, data: data});
		// 	}
		// });

		if (fromMillis && toMillis) {
			slice = this.logger.filter(function(object){
				return object.timestamp >= fromMillis && object.timestamp <= toMillis;
			});

			//ensure that the data is arrange in order of timestamp increasing order
			slice.sort(function(a, b){
				return a.timestamp - b.timestamp;
			});

			callback({status: true, data: slice});
		}
		else
			callback({status: true, data: this.logger.slice(0, this.logger.length)});
	},
	processEvent: function(event){
		switch(event.toLowerCase()){
			case "zadd": this.loadServerData(); break;
		}
	},
	loadServerData: function(){
		//this method gets all new data from the redis server for caching on the javascript end. Not sure how the cached that would be used just yet
		var fromStamp = 0, self = this;

		if (self.logger.length > 0)
			fromStamp = this.logger[self.logger.length - 1].timestamp + 1;

		//get the last set of entries from the data store and cache them
		//add 1 to offset the millisecond so that the last one we already have would not be retrieved
		self.getSeries(function (resp) {
			if (resp.status) {
				resp.data.forEach(function (obj) {
					self.logger.push(obj);
				});
			}
			else
				console.log("ERROR", resp.error);
		}, fromStamp + '', 'inf');
	},
	setMaxSlots: function(slots){
		this.space = slots && slots > 0 ? parseInt(slots) : -1;

		//we need to check if the maximum has already been exceeded
		this.performDataRegularization();
	},
	performDataRegularization: function(){
		var amount, from, to, self = this;

		//the amount of entries to store was set and we have exceeded the maximum set number of entries allowed
		if( this.space > 0 && this.logger.length > this.space ){
			amount = this.logger.length - this.space;
			from = this.logger[0].timestamp;
			to = this.logger[amount - 1].timestamp;

			this.redis.rawCall(['ZREMRANGEBYSCORE', this.key, from, to], function(e){
				if( e )
					console.log("ERROR", resp.error);
				else
					self.logger.splice(0, amount);
			});
		}
	},
	deleteKey: function(){ this.redis.rawCall(['DEL', this.key]) }//TODO remove this method
};

module.exports = JLogger;
