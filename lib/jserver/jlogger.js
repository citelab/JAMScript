var Redis = require('redis-fast-driver');

var JLogger = function(key, fresh, JManager, data_prototype, refresh_rate, slots, redis){
	console.log("Creating Logger ... " + key);
	this.key = key + '';
	this.sequenceNumber = 0;
	this.delimeter = "$$$";
	this.space = slots && slots > 0 ? parseInt(slots) : -1;//the amount of entries to store
	this.logger = [];
	this.redis = redis ? redis : new Redis({
		"host": '127.0.0.1',
		"port": 6379
		//Default Values
	});
	if(JManager)
		JManager.jmanager_add_jlogger(this);

	this.datatype = data_prototype; //For example, number, string, array, object .... Not sure if we need implementation yet.
	this.set_size = 0;
	//Refresh Rate is how frequently we refresh the jdata value
	//Here a negative value = No Refresh values
	//A zero value means refresh as event arrives,
	//A positive value means refresh as stated by refresh_rate in miliseconds, aka the newest value
	if(refresh_rate == undefined)
		this.refresh_rate = 0;
	else
		this.refresh_rate = refresh_rate;

	this.fresh = fresh;
	this.index_of_last_value = -1; //So we can zrange without having to retrieve everything
	this.data_value = []; //This is the data value for the set

	this.data_rcv_callback = undefined; //If the user wants a specific action to occur at every event we receive for a specific logger
	this.jlogger_request_set_size();
	if(refresh_rate > 0)
		this.jlogger_request_value_refresh();
};

JLogger.prototype = {
	jlogger_set_refresh_rate: function(refresh_rate){
		if(this.refresh_rate == 0)
			setTimeout(this.jlogger_request_value_refresh, refresh_rate);
		this.refresh_rate = refresh_rate;
	},

	jlogger_get_series_true_size: function(){
		return this.set_size;
	},

	jlogger_get_series_avail_size: function(){
		return this.index_of_last_value + 1;
	},

	jlogger_get_all_values: function(){
		return this.data_value;
	},
	jlogger_request_set_size: function(){
		var logger = this;
		this.redis.rawCall(["ZCARD", this.key],
				function(error, response){
					logger.jlogger_request_set_size_callback(error, response, logger);
				}
		);
	},

	jlogger_request_set_size_callback: function(error, response, logger){
		if(error)
			throw error;
		logger.set_size = response;
		if(logger.fresh)
			logger.index_of_last_value = response - 1; //So we don't get old messages in storage previously
	},

	jlogger_get_newest_value: function(){
		if(this.set_size == 0)
			throw "Empty Set";
		return this.data_value[this.index_of_last_value - 1];
	},
	jlogger_get_value_at: function(index){
		if(this.set_size == 0)
			throw "Empty Set";
		if(index < 0 || index > this.index_of_last_value - 1)
			throw "Invalid Index";
		return this.data_value[index];
	},

	jlogger_get_range_values: function(start, range){
		if(start < 0 || start + range >= this.index_of_last_value)
			throw "Invalid Range ...";
		return this.data_value.slice(start, start + range);
	},

	jlogger_set_new_log_callback(callback){
		//Note the callback will be sent a single string denoting the keyword for the log
		this.data_rcv_callback = callback;
	},

	jlogger_request_value_refresh: function(){
		//There's no point requesting for data if there is nothing ...
		var process = this.jlogger_process_zrange_response;
		var logger = this;
		if(this.index_of_last_value + 1 < this.set_size){
			this.zrange(this.key, this.index_of_last_value + 1, -1,
				function(e, response){
					process(e, response, logger);
				});
		}
		if(this.refresh_rate > 0)
			setTimeout(this.jlogger_request_value_refresh, this.refresh_rate);
	},

	jlogger_process_zrange_response: function(e, response, logger){
		var data_index;
		var time_stamp_index;
		var entry;
		if(e){
			throw e;
		}else{
			if(response == undefined)
				return;
			for(var i = 0; i < response.length; i++){
				data_index = response[i].indexOf("$$$");
				time_stamp_index = response[i].lastIndexOf("$$$");
				entry = {log:response[i].slice(0, data_index), time_stamp:response[i].slice(time_stamp_index + 3, response[i].length)};
				logger.data_value.push(entry);
				logger.index_of_last_value++;
				console.log("Entry pushed .. ", entry);
				/*
				if(refresh_size && i == response.length -1){
						//Attempt to update the size ... in case it did not update or misssed it
						var size = parseInt(response[i].slice(response[i].lastIndexOf("$$$", time_stamp_index - 1) + 3, time_stamp_index));
						if(size > this.set_size)
							this.set_size = size;
				}*/
				if(logger.data_rcv_callback)
					logger.data_rcv_callback(response[i]);
			}

			if(logger.index_of_last_value + 1 > logger.set_size)
				logger.set_size = logger.index_of_last_value;

		}
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

		this.redis.rawCall(["EVAL", "redis.replicate_commands();" +
												"local t = (redis.call('TIME'))[1];" +
												"local insert_order =  redis.call('ZCARD', KEYS[1]) + 1;" +
												"redis.call('ZADD', KEYS[1], t, ARGV[1] .. \"$$$\" .. insert_order .. \"$$$\" .. t);" +
												"return {t}", 1, this.key, entry + this.delimeter + (this.sequenceNumber++)], function(e, d){
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
