const Redis = require('redis-fast-driver');

var debug = false;

/* datastream stores (value, timestamp) pairs */
module.exports = class JAMDatastream{
	/* devId       - ID of the device from which this datastream comes (string)
	 * key         - name of this datastream
	 * fresh       - if this datastream is newly created (Boolean)
	 * jammanager  -
	 * refreshRate - the time elapse between two value-refreshing (number)
	 * redis       - a Redis client for storing data
	 */
	constructor(devId, key, fresh, jammanager, redis, refreshRate){
		if(debug) console.log("Creating datastream ... " + key);

		this.description = 'data from device ' + devId;
		this.delimiter   = '$$$';
		this.devId       = devId;
		this.key         = key + '';
		this.fresh       = fresh;		
		/* if jammanager is defined, then add this datastream to be managed by this jammanager */	
		if(jammanager) jammanager.add_jamdatastream(this);
		/* if redis is NOT defined, use the default redis client */
		this.redis = redis ? redis : new Redis({
			"host": '127.0.0.1',
			"port": 6379
		});		
		
		/* # data that has been processed */
		this.processedDataNum  = 0;
		this.tailIndex         = -1;
		/* the function of processing data is to be defined */
		this.processDataFunc   = undefined;

		/* refreshRate is how frequently we refresh the jdata value
		 * < 0: no refresh values
		 * = 0: refresh as event arrives
		 * > 0: refresh as stated by refreshRate in ms
		 */
		if(refreshRate == undefined) this.refreshRate = 0; else this.refreshRate = refreshRate;
		if(refreshRate >0 ) this.refreshValues();
	}

	/* Public API */

	/* returns # (value, timestamp) pairs in the data stream */
	size(){
		return this.length;
	}

	isEmpty(){
		return this.size() == 0;
	}

	/* returns the last data pair (value, timestamp)
	 * value is of type Number, timestamp is of type Date 
	 */
	lastData(){
		if(!this.isEmpty()){
			var data = this[this.size()-1];
			return{
				value: new Number(data.log),
				timestamp: new Date(data.timestamp*1000)
			}
		}
		return null;
	}

	lastValue(){
		if(!this.isEmpty()) return new Number(this[this.size()-1].log);
		return null;
	}

	/* returns an array containing all (value, timestamp) pairs */
	data(){
		return this.map(function(pair){
			return {
				value: new Number(pair.log),
				timestamp: new Date(pair.timestamp*1000)
			};
		});
	}

	/* returns an array containing values of all (value, timestamp) pairs */
	values(){
		return this.map(function(pair){
			return new Number(pair.log);
		});
	}

	/* returns an array containing the last n (value, timestamp) pairs */
	nData(n){
		if(!Number.isInteger(n)) throw new TypeError('Input must be a non-negative integer');
		else if(n<0) throw new RangeError('Input must be a non-negative integer');

		if(this.isEmpty() || n==0) return [];
		if(n>this.length) n = this.length;

		return this.slice(this.length-n).map(function(pair){
			return {
				value: new Number(pair.log),
				timestamp: new Date(pair.timestamp*1000)
			};
		});
	}

	/* returns an array containing values of the last n values in data_values */
	nValues(n){
		if(!Number.isInteger(n)) throw new TypeError('Input must be a non-negative integer'); 
		else if(n<0) throw new RangeError('Input must be a non-negative integer'); 

		if(this.isEmpty() || n==0) return []; 
		if(n>this.length) n = this.length; 

		return this.slice(this.length-n).map(function(pair){
			return new Number(pair.log);
		});
	} 

	/* returns an array containing all (value, timestamp) pairs after a time point */
	dataAfter(timestamp){
		if(!Number.isInteger(timestamp)) throw new TypeError('Input must be a non-negative integer'); 
		else if(timestamp<0) throw new RangeError('Input must be a non-negative integer'); 

		/* filter() creates a new array with all elements 
		 * that pass the test implemented by the provided function
		 */
		return this.filter(function(pair){
			return Math.floor(timestamp.getTime()/1000) < pair.timestamp;
		}).map(function(pair){
			return {
				value: new Number(pair.log),
				timestamp: new Date(pair.timestamp * 1000)
			};
		});
	}

	/* returns an array containing values of all (value, timestamp) pairs after a time point */
	valuesAfter(timestamp){
		if(!Number.isInteger(timestamp)) throw new TypeError('Input must be a non-negative integer'); 
		else if(timestamp<0) throw new RangeError('Input must be a non-negative integer'); 

		return this.filter(function(pair){
			return Math.floor(timestamp.getTime()/1000) < pair.timestamp;
		}).map(function(pair){
			return new Number(pair.log);
		});
	}

	/* returns an array containing all (value, timestamp) pairs that come between two specified time points */
	dataBetween(fromTimestamp, toTimestamp){
		if(!Number.isInteger(fromTimestamp) || !Number.isInteger(toTimestamp)) throw new TypeError('Inputs must be non-negative integers'); 
		else if(fromTimestamp<0 || toTimestamp<0) throw new RangeError('Inputs must be non-negative integers'); 

		return this.filter(function(pair){
			return Math.floor(fromTimestamp.getTime()/1000 < pair.timestamp && toTimestamp.getTime()/1000 > pair.timestamp);
		}).map(function(pair){
			return {
				value: new Number(pair.log),
				timestamp: new Date(pair.timestamp * 1000)
			};
		});
	}

	/* returns an array containing values of all (value, timestamp) come between two specified time points */
	valueBetween(fromTimestamp, toTimestamp){
		if(!Number.isInteger(fromTimestamp) || !Number.isInteger(toTimestamp)) throw new TypeError('Inputs must be non-negative integers'); 
		else if(fromTimestamp<0 || toTimestamp<0) throw new RangeError('Inputs must be non-negative integers'); 

		return this.filter(function(pair){
			return Math.floor(fromTimestamp.getTime()/1000 < pair.timestamp && toTimestamp.getTime()/1000 > pair.timestamp);
		}).map(function(pair){
			return new Number(pair.log);
		});
	}

	/* set callback function to process data */
 	setProcessDataFunc(f) {
 		if(typeof f != 'function') throw new TypeError('Input must be a function');
        // note the callback will be sent a single string denoting the keyword for the log
        this.processData = f;
    }

	refreshValues() {
		/* processedDataNum is only updated when the response is processed
		 * here we check if there's response needs to be processed
		 */
        if (this.tailIndex + 1 < this.processedDataNum) {
			/* Out of range indexes will not produce an error. 
			 * If start > largest index in the sorted set, or start > stop, an empty list is returned. 
			 * If stop > end of the sorted set Redis will treat it like it is the last element of the sorted set.
			 */
            this.redis.rawCall(['zrange', this.key, this.tailIndex + 1, -1],
				/* this is the callback function of zrange()
				 * response is an array containing responses to be processed
				 * each response is used to create a data pair that goes into the datastream. 
				 */
                function (e, response) {
                    if (!response) return;
                    if (e) throw e;
                    var parts;
                    var entry;
                    for (var i = 0; i < response.length; i++) {
                        // a response is of the form: log$$$ $$$ $$$timestamp
                        parts = response[i].split(this.delimiter);
                        entry = {
                            log: parts[0],
                            timestamp: parts[3]
                        };
						/* add this new entry to the datastream */
                        this.push(entry);
                        this.tailIndex++;
                        if (debug) console.log('Received data: ' + entry + '\n' + this.tailIndex);
						/* if the processData is defined, execute it with the response */
                        if (this.processDataFunc) this.processDataFunc(response[i]);
                    }
					/* now there are more data that has been processed */
                    this.processedDataNum = this.tailIndex;
                }
            );
			/* checks and processes new data constantly */
            if (this.refreshRate > 0) {
                setTimeout(this.refreshValues.bind(this), this.refreshRate);
            }
        }
    }

	setRefreshRate(refreshRate){
		if(!Number.isInteger(refreshRate)) throw new TypeError('refreshRate must be -1, 0 or a non-negative integer');
		else if(refreshRate<0 && refreshRate != -1) throw new RangeError('refreshRate must be -1, 0 or a non-negative integer');

		this.refreshRate = refreshRate;
		if(this.refreshRate > 0){
			setTimeout(this.refreshValues(), refreshRate);
		}
	}
}