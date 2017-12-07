var Redis = require('redis-fast-driver');
var cbor  = require('cbor');
var debug = false;

class JAMDatastream {

    constructor(dev_id, key, fresh, jammanager, data_prototype, refresh_rate, slots, redis) {
        if (debug) {
            console.log("Creating datastream ... " + key);
        }

        this.dev_id = dev_id;
        this.description = 'data from device ' + dev_id;

        this.key = key + '';
        this.sequenceNumber = 0;
        this.delimiter = jammanager ? jammanager.delimiter : '$$$';
        this.space = slots && slots > 0 ? parseInt(slots) : -1; // the amount of entries to store
        this.datastream = [];
        this.datasource = null;
        this.jammanager = jammanager;
        this.level = jammanager.getLevelCode();

        this.redis = redis ? redis : new Redis({
            "host": '127.0.0.1',
            "port": 6379
        });
        if (jammanager) {
            jammanager.add_jamdatastream(this);
        }

        this.datatype = data_prototype; //For example, number, string, array, object .... Not sure if we need implementation yet.
        this.set_size = 0;

        // Refresh Rate is how frequently we refresh the jdata value
        // Here a negative value = No Refresh values
        // A zero value means refresh as event arrives,
        // A positive value means refresh as stated by refresh_rate in miliseconds, aka the newest value
        if (refresh_rate == undefined) {
            this.refresh_rate = 0;
        } else {
            this.refresh_rate = refresh_rate;
        }

        this.fresh = fresh;
        this.index_of_last_value = -1; //So we can zrange without having to retrieve everything
        this.data_values = []; //This is the data value for the set

        this.data_rcv_callback = undefined; //If the user wants a specific action to occur at every event we receive for a specific datastream
        this.request_set_size();
        if (refresh_rate > 0) {
            this.request_value_refresh();
        }

        this.listeners = [];
    }

    setDatasource(datasource){
        this.datasource = datasource;
    }

    getDatasource(){
        return this.datasource;
    }

    getDeviceId(){
        return this.dev_id;
    }

    getLevel() {
        return this.level;
    }

    // public API

    /*
     size()
     Returns the number of data pairs (value, timestamp) in the data stream.
     Example:
     var n = x[0].size();
     console.log(n);
     1024
     */
    size() {
        return this.data_values.length;
    }

    /*
     isEmpty()
     Returns true (Boolean) if the data stream is empty (contains no data pairs);
     false otherwise.
     Example:
     var empty = x[0].isEmpty();
     console.log(empty);
     false
     */
    isEmpty() {
        return this.size() === 0;
    }

    /*
     lastData()

     Returns the last data pair (value, timestamp) in the data stream or null if
     the data stream is empty. The value is of type Number and the timestamp is
     of type Date.

     Example:
     var d = x[0].lastData();
     console.log(d.value); // Number
     32.5
     console.log(d.timestamp); // Date
     2017-02-23T23:08:51.141Z
     4
     */
    lastData() {
        if (!this.isEmpty()) {
            var data = this.data_values[this.size() - 1], value;
            // if the content of the string is a number
            if(Number(data.log) == data.log) value = Number(data.log);
            // if the string starts with '{' then it could have been a JSON object
            else if(String(data.log).indexOf('{') == 0){
                try{ value = JSON.parse(data.log); }
                catch(e){ value = data.log; }
            }
            else value = data.log;
            return {
                value: value,
                timestamp: new Date(data.time_stamp * 1000)
            };
        }
        return null;
    }

    /*
     lastValue()

     Returns the last value (of type Number) in the data stream or null if the
     data stream is empty.

     Example:
     var v = x[0].lastValue();
     console.log(v); // Number
     32.5
     */
    lastValue() {
        if (!this.isEmpty()) {
            var data = this.data_values[this.size() - 1], value;
            // if the content of the string is a number
            if(Number(data.log) == data.log) value = Number(data.log);
            // if the string starts with '{' then it could have been a JSON object
            else if(String(data.log).indexOf('{') == 0){
                try{ value = JSON.parse(data.log); }
                catch(e){ value = data.log; }
            }
            else value = data.log;
            return value;
        }
        return null;
    }

    /*
     data()

     Returns an array containing all data pairs (value, timestamp) in the data
     stream. The values are of type Number and the timestamps are of type Date.

     Example:
     var d = x[0].data();
     console.log(d.length);
     1024
     console.log(d[0].value); // Number
     32.5
     console.log(d[0].timestamp); // Date
     2017-02-23T23:08:51.141Z
     */
    data() {
        if (this.isEmpty()) return null;
        return this.data_values.map(function(d){
            var value;
            // if the content of the string is a number
            if(Number(d.log) == d.log) value = Number(d.log);
            // if the string starts with '{' then it could have been a JSON object
            else if(String(d.log).indexOf('{') == 0){
                try{ value = JSON.parse(d.log); }
                catch(e){ value = d.log; }
            }
            else value = d.log;
            return {
                value: value,
                timestamp: new Date(d.time_stamp * 1000)
            };
        });
    }

    /*
     values()

     Returns an array containing all values (of type Number) in the data stream.

     Example:
     var v = x[0].values();
     console.log(v.length);
     1024
     console.log(v[0]); // Number
     32.5
     */
    values() {
        if (this.isEmpty()) return null;
        return this.data_values.map(function(d) {
            var value;
            // if the content of the string is a number
            if(Number(d.log) == d.log) value = Number(d.log);
            // if the string starts with '{' then it could have been a JSON object
            else if(String(d.log).indexOf('{') == 0){
                try{ value = JSON.parse(d.log); }
                catch(e){ value = d.log; }
            }
            else value = d.log;
            return value;
        });
    }

    /*
     n_data(N)

     Returns an array containing the last N data pairs (value, timestamp) in the
     data stream. The values are of type Number and the timestamps are of type
     Date. Parameter N is a positive integer. If N is invalid, then an exception
     is thrown. If there are fewer than N data pairs in the data stream, then the
     length of the returned array is smaller than N.

     Example:
     var d = x[0].n_data(100);
     console.log(d.length); // less than or equal to 100
     100
     5
     console.log(d[0].value); // Number
     32.5
     console.log(d[0].timestamp); // Date
     2017-02-23T23:08:51.141Z
     */
    n_data(N) {
        if (!Number.isInteger(N)) {
            throw new TypeError('N must be a positive integer');
        }

        if (N <= 0) {
            throw new RangeError('N must be a positive integer');
        }

        if (this.isEmpty()) {
            return [];
        }

        if (N > this.size()) {
            N = this.size();
        }

        return this.data_values.slice(this.size() - N).map(function(d) {
            var value;
            // if the content of the string is a number
            if(Number(d.log) == d.log) value = Number(d.log);
            // if the string starts with '{' then it could have been a JSON object
            else if(String(d.log).indexOf('{') == 0){
                try{ value = JSON.parse(d.log); }
                catch(e){ value = d.log; }
            }
            else value = d.log;
            return {
                value: value,
                timestamp: new Date(d.time_stamp * 1000)
            };
        });
    }

    /*
     n_values(N)

     Returns an array containing the last N values (of type Number) in the data
     stream. Parameter N is a positive integer. If N is invalid, then an exception
     is thrown. If there are fewer than N values in the data stream, then the
     length of the returned array is smaller than N.

     Example:
     var v = x[0].n_values(100);
     console.log(v.length); // less than or equal to 100
     100
     console.log(v[0]); // Number
     32.5
     */
    n_values(N) {
        if (!Number.isInteger(N)) {
            throw new TypeError('N must be a positive integer');
        }

        if (N <= 0) {
            throw new RangeError('N must be a positive integer');
        }

        if (this.isEmpty()) {
            return [];
        }

        if (N > this.size()) {
            N = this.size();
        }

        return this.data_values.slice(this.size() - N).map(function(d) {
            var value;
            // if the content of the string is a number
            if(Number(d.log) == d.log) value = Number(d.log);
            // if the string starts with '{' then it could have been a JSON object
            else if(String(d.log).indexOf('{') == 0){
                try{ value = JSON.parse(d.log); }
                catch(e){ value = d.log; }
            }
            else value = d.log;
            return value;
        });
    }

    /*
     dataAfter(timestamp)

     Returns an array containing all data pairs (value, timestamp) in the data
     stream with a timestamp after timestamp (exclusive). For each data pair, the
     value is of type Number and the timestamp is of type Date. Parameter timestamp
     is of type Date.

     Example:
     var timestamp = new Date(2017, 1, 22, 7, 55, 16);
     var d = x[0].dataAfter(timestamp);
     console.log(d.length);
     64
     console.log(d[0].value); // Number
     32.5
     console.log(d[0].timestamp); // Date
     2017-02-22T12:55:16.000Z
     */
    dataAfter(timestamp) {
        return this.data_values.filter(function(d) {
            return Math.floor(timestamp.getTime() / 1000) < d.time_stamp;
        }).map(function(d) {
            var value;
            // if the content of the string is a number
            if(Number(d.log) == d.log) value = Number(d.log);
            // if the string starts with '{' then it could have been a JSON object
            else if(String(d.log).indexOf('{') == 0){
                try{ value = JSON.parse(d.log); }
                catch(e){ value = d.log; }
            }
            else value = d.log;
            return {
                value: value,
                timestamp: new Date(d.time_stamp * 1000)
            };
        });
    }

    /*
     valuesAfter(timestamp)

     Returns an array containing all values (of type Number) the data stream with
     a timestamp after timestamp (exclusive). Parameter timestamp is of type Date.

     Example:
     var timestamp = new Date(2017, 1, 22, 7, 55, 16);
     var v = x[0].valuesAfter(timestamp);
     console.log(v.length);
     64
     console.log(v[0]); // Number
     32.5
     6
     */
    valuesAfter(timestamp) {
        return this.data_values.filter(function(d) {
            return Math.floor(timestamp.getTime() / 1000) < d.time_stamp;
        }).map(function(d) {
            var value;
            // if the content of the string is a number
            if(Number(d.log) == d.log) value = Number(d.log);
            // if the string starts with '{' then it could have been a JSON object
            else if(String(d.log).indexOf('{') == 0){
                try{ value = JSON.parse(d.log); }
                catch(e){ value = d.log; }
            }
            else value = d.log;
            return value;
        });
    }

    /*
     dataBetween(fromTimestamp, toTimestamp)

     Returns an array containing all data pairs (value, timestamp) in the data
     stream with a timestamp between fromTimestamp and toTimestamp (both exclusive).
     For each data pair, the value is of type Number and the timestamp is of type
     Date. Parameters fromTimestamp and toTimestamp are of type Date.

     Example:
     var fromTimestamp = new Date(2017, 1, 22, 7, 55, 16);
     var toTimestamp = new Date(2017, 1, 23, 7, 55, 16);
     var d = x[0].dataBetween(fromTimestamp, toTimestamp);
     console.log(d.length);
     64
     console.log(d[0].value); // Number
     32.5
     console.log(d[0].timestamp); // Date
     2017-02-22T12:55:16.000Z
     */
    dataBetween(fromTimestamp, toTimestamp) {
        return this.data_values.filter(function(d) {
            return Math.floor(fromTimestamp.getTime() / 1000) < d.time_stamp &&
                d.time_stamp < Math.floor(toTimestamp.getTime() / 1000);
        }).map(function(d) {
            var value;
            // if the content of the string is a number
            if(Number(d.log) == d.log) value = Number(d.log);
            // if the string starts with '{' then it could have been a JSON object
            else if(String(d.log).indexOf('{') == 0){
                try{ value = JSON.parse(d.log); }
                catch(e){ value = d.log; }
            }
            else value = d.log;
            return {
                value: value,
                timestamp: new Date(d.time_stamp * 1000)
            };
        });
    }

    /*
     valuesBetween(fromTimestamp, toTimestamp)

     Returns an array containing all values (of type Number) in the data stream
     with a timestamp between fromTimestamp and toTimestamp (both exclusive).
     Parameters fromTimestamp and toTimestamp are of type Date.

     Example:
     var fromTimestamp = new Date(2017, 1, 22, 7, 55, 16);
     var toTimestamp = new Date(2017, 1, 23, 7, 55, 16);
     var v = x[0].valuesBetween(fromTimestamp, toTimestamp);
     console.log(v.length);
     64
     console.log(v[0]); // Number
     32.5
     */
    valuesBetween(fromTimestamp, toTimestamp) {
        return this.data_values.filter(function(d) {
            return Math.floor(fromTimestamp.getTime() / 1000) < d.time_stamp &&
                d.time_stamp < Math.floor(toTimestamp.getTime() / 1000);
        }).map(function(d) {
            var value;
            // if the content of the string is a number
            if(Number(d.log) == d.log) value = Number(d.log);
            // if the string starts with '{' then it could have been a JSON object
            else if(String(d.log).indexOf('{') == 0){
                try{ value = JSON.parse(d.log); }
                catch(e){ value = d.log; }
            }
            else value = d.log;
            return value;
        });
    }

    // internal implementation

    set_refresh_rate(refresh_rate) {
        if (this.refresh_rate == 0) {
            setTimeout(this.request_value_refresh.bind(this), refresh_rate);
        }
        this.refresh_rate = refresh_rate;
    }

    get_series_true_size() {
        return this.set_size;
    }

    get_series_avail_size() {
        return this.data_values.length;
    }

    get_all_values() {
        return this.data_values;
    }

    request_set_size() {
        var datastream = this;
        this.redis.rawCall(["ZCARD", this.key],
            function(error, response) {
                datastream.request_set_size_callback(error, response, datastream);
            }
        );
    }

    request_set_size_callback(error, response, datastream) {
        if (error) {
            throw error;
        }
        datastream.set_size = response;
        if (datastream.fresh) {
            datastream.index_of_last_value = response - 1; //So we don't get old messages in storage previously
        }
    }

    get_newest_value() {
        if (this.set_size == 0) {
            throw "Empty Set";
        }
        return this.data_values[this.data_values.length - 1];
    }

    get_value_at(index) {
        if (this.set_size == 0) {
            throw "Empty Set";
        }
        if (index < 0 || index > this.data_values.length - 1) {
            throw "Invalid Index";
        }
        return this.data_values[index];
    }

    get_range_values(start, range) {
        if (start < 0 || start + range >= this.data_values.length) {
            throw "Invalid Range ...";
        }
        return this.data_values.slice(start, start + range);
    }

    set_new_log_callback(callback) {
        //Note the callback will be sent a single string denoting the keyword for the log
        this.data_rcv_callback = callback;
    }

    request_value_refresh() {
        // There's no point requesting for data if there is nothing ...
        var process = this.process_zrange_response;
        var datastream = this;
        if (this.index_of_last_value + 1 < this.set_size) {
            this.zrange(this.key, this.index_of_last_value + 1, -1,
                function(e, response) {
                    process(e, response, datastream);
                });
        }
        if (this.refresh_rate > 0) {
            setTimeout(this.request_value_refresh.bind(this), this.refresh_rate);
        }
    }

    process_zrange_response(e, response, datastream) {
        var parts;
        var entry;
        var dest = datastream.datasource.getDestination();

        if (e) {
            throw e;
        } else {
            if (response == undefined) {
                return;
            }
            for (var i = 0; i < response.length; i++) {
                parts = response[i].split(datastream.delimiter);
                var log = parts[0];
                //console.log("over here");

                if( log.substring(0, 1) === "{" ){
                    //console.log("In if");
                    try{
                        log = JSON.parse(log);
                    }
                    catch(e){
                        console.log("WARN! Error parsing suspicious JSON string");
                        log = parts[0];
                    }
                }
                else if (parts.length > 3 && parts[3] === "cbor") {
                    var blog = Buffer.from(parts[0], 'base64');
                    try {
                        log = cbor.decodeFirstSync(blog);
                        if (debug) console.log(log);
                    } catch(e) {
                        console.log("WARN! Error decoding data.. ", parts[0]);
                        log = parts[0];
                    }
                }

                entry = {
                    log: log,
                    time_stamp: parts.length > 3 ? parts[4] : parts[3]
                };
                datastream.data_values.push(entry);
                datastream.index_of_last_value++;

                if (debug) {
                    console.log("Received data: ", entry);
                    console.log(datastream.index_of_last_value);
                }

                /*
                 if(refresh_size && i == response.length -1){
                 //Attempt to update the size ... in case it did not update or misssed it
                 var size = parseInt(response[i].slice(response[i].lastIndexOf(this.delimiter, time_stamp_index - 1) + 3, time_stamp_index));
                 if(size > this.set_size)
                 this.set_size = size;
                 }*/

                if (datastream.data_rcv_callback) {
                    datastream.data_rcv_callback(response[i]);
                }

                //Added by Richboy on Sat 3 June 2017
                //inform listeners about new data
                for( let listener of datastream.listeners ){
                    if( listener.notify && typeof listener.notify === 'function' )
                        listener.notify.call(listener, datastream.key, entry, datastream);
                    else if( typeof listener === 'function' )
                        listener.call({}, datastream.key, entry, datastream);
                }


                //Check if this stream is to be sent to the parent
                let forward = false;
                if( datastream.jammanager.parentRedis != null ) {//if the redis connection to parent is not null
                    switch (datastream.level) {
                        case "dev":
                        case "device":
                            if (dest == "fog" || dest == "cloud")
                                forward = true;
                            break;
                        case "fog":
                            if( dest == "cloud" )
                                forward = true;
                    }
                }
                if( forward )
                    datastream.jammanager.simpleLog(datastream.key, response[i], null, datastream.jammanager.parentRedis, (parts.length > 3 ? parts[4] : parts[3]) - 0);
            }

            if (datastream.index_of_last_value + 1 > datastream.set_size) {
                datastream.set_size = datastream.index_of_last_value;
            }
        }
    }

    zrange(key, start, range, callback) {
        this.redis.rawCall(['ZRANGE', key, start, range], callback);
    }

    log(entry, callback, redis) {
        var self = this;

        if( !redis )
            redis = this.redis;

        var entryType = typeof entry, datatype = this.datasource.getDataType();
        // check if the this datastream accept this type of data
        if(datatype){
            if(entryType != datatype) {
                callback({
                    status: false,
                    error: "Only data of type "+datatype+" is allowed"
                });
                return;
            }
        }else{ this.datasource.setDataType(entryType);}

        if(entryType == "object") entry = JSON.stringify(entry);
        else if(entryType != 'number' && entryType != 'string'){
            callback({
                status: false,
                error: "Only data of type "+datatype+" is allowed"
            });
            return;
        }

        redis.rawCall(["EVAL", "redis.replicate_commands();"+
        "local t = (redis.call('TIME'))[1];" +
        "local insert_order =  redis.call('ZCARD', KEYS[1]) + 1;" +
        "redis.call('ZADD', KEYS[1], t, ARGV[1] .. \"" + self.delimiter + "\" .. insert_order .. \"" + self.delimiter + "\" .. t);" +
        "return {t}", 1, this.key, entry + this.delimiter + (this.sequenceNumber++)
        ], function(e, d) {
            if (e) {
                if (callback) {
                    callback({
                        status: false,
                        error: e
                    });
                }
            } else {
                self.datastream.push({
                    entry: entry,
                    timestamp: d[0] - 0
                }); //convert the returned timestamp to a number
                if (callback) {
                    setTimeout(function() {
                        callback({
                            status: true,
                            message: 'Data added!',
                            timestamp: d[0] - 0
                        });
                    }, 0);
                }

                // if addition was successful, we need to run a command to remove all previous data if
                // the amount of entries to store was set and we have exceeded the maximum set number of entries allowed
                self.performDataRegularization();
            }
        });
    }

    getSeries(callback, fromMillis, toMillis) { // TODO needs to be revised cause of the data caching
        var fr, to, command, i, data = [],
            self = this,
            slice;

        if (fromMillis && toMillis) {
            slice = this.datastream.filter(function(object) {
                return object.timestamp >= fromMillis && object.timestamp <= toMillis;
            });

            // ensure that the data is arrange in order of timestamp increasing order
            slice.sort(function(a, b) {
                return a.timestamp - b.timestamp;
            });

            callback({
                status: true,
                data: slice
            });
        } else {
            callback({
                status: true,
                data: this.datastream.slice(0, this.datastream.length)
            });
        }
    }

    processEvent(event) {
        switch (event.toLowerCase()) {
            case "zadd":
                this.loadServerData();
                break;
        }
    }

    loadServerData() {
        // this method gets all new data from the redis server for caching on the javascript end. Not sure how the cached that would be used just yet
        var fromStamp = 0,
            self = this;

        if (self.datastream.length > 0) {
            fromStamp = this.datastream[self.datastream.length - 1].timestamp + 1;
        }

        // get the last set of entries from the data store and cache them
        // add 1 to offset the millisecond so that the last one we already have would not be retrieved
        self.getSeries(function(resp) {
            if (resp.status) {
                resp.data.forEach(function(obj) {
                    self.datastream.push(obj);
                });
            } else {
                console.log("ERROR", resp.error);
            }
        }, fromStamp + '', 'inf');
    }

    setMaxSlots(slots) {
        this.space = slots && slots > 0 ? parseInt(slots) : -1;

        //we need to check if the maximum has already been exceeded
        this.performDataRegularization();
    }

    performDataRegularization() {
        var amount, from, to, self = this;

        // the amount of entries to store was set and we have exceeded the maximum set number of entries allowed
        if (this.space > 0 && this.datastream.length > this.space) {
            amount = this.datastream.length - this.space;
            from = this.datastream[0].timestamp;
            to = this.datastream[amount - 1].timestamp;

            this.redis.rawCall(['ZREMRANGEBYSCORE', this.key, from, to], function(e) {
                if (e) {
                    if (debug) {
                        console.log("ERROR", resp.error);
                    }
                } else {
                    self.datastream.splice(0, amount);
                }
            });
        }
    }

    //Added by Richboy on Sat 3 June 2017
    subscribe(listener){
        this.listeners.push(listener);
    }

    //Added by Richboy on Sat 3 June 2017
    unsubscribe(listener){
        for( let i = 0; i < this.listeners.length; i++ ){
            if( this.listeners[i] == listener ){
                this.listeners.splice(i, 1);
                break;
            }
        }
    }

    deleteKey() {
        this.redis.rawCall(['DEL', this.key]);
    }

    // allows other application to refer to this datastream using its key.
    setKey(key){
        var currKey = this.key;

        //check if the key is an object
        if( Boolean(key) && typeof key === 'object' )   //convert the key to string
            this.key = this.jammanager.buildKey(key);
        else
            this.key = key;

        this.jammanager.delete_jamdatastream(currKey);
        this.jammanager.add_jamdatastream(this);
    }

    getKey(){
        return this.key;
    }

}

module.exports = JAMDatastream;
