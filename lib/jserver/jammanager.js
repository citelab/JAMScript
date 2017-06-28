/**
 * This file listens for events in the key space and takes the required action. It also
 */

var Redis = require('redis-fast-driver');
var JAMDatastream = require('./jamdatastream.js');

var jamdatastream_callbacks = {};
var jamdatasources = {};
var initalizing = true;
var debug = false;

const cmdParser = require('./cmdparser.js');
var app = cmdParser().app || 'DEFAULT_APP';

// get the hostname
var sync_exec = require('sync-exec');
var host;
var res = sync_exec("hostname -I").stdout;
var arr = res.split(" ");
host = arr[0]; 
console.log("JAMDatasource: Redis on host",host);

module.exports = (function(host, port) {
    /**
     * Each element in the jamdata is a pair of key => jamdatastream.
     * Sample: key: jamdatastream: ...
     * key is the unique key which would receive the storage elements or act as the subscription handle/tag
     * object is a JAMDatastream object
     * @type {Object}
     */
    var jamdatastreams = {};
    var msg_receive_callback;

    // this is the redis instance that would be sent to all broadcast domains...
    // and would be used to broadcast messages to all subscribed
    var broadcaster = new Redis({
        host: host,
        port: port
    });

    // this would listen for all keyspace events (using the keyevent notification mechanism) and channel it to the right jamdatastream
    var listener = new Redis({
        host: host,
        port: port
    });

    // this is the handle that would be passed to all instances of the JAMDatastream for making a call to the Redis server
    var executor = new Redis({
        host: host,
        port: port
    });

    //This will hold a connection to the redis of the parent of the current level in the hierarchy.
    //For e.g device->Fog; fog->Cloud
    var parentRedis = null; //first default to null. connectToParent method will set the connection

    //Added by Richboy on Sat 3 June 2017
    //This holds all listeners for data/event changes on Redis
    //Each listener subscribes to a particular key which will be accessible via listeners.{key}
    //listeners.{key} is an array of all listeners subscribing to that data changes in that key
    var listeners = {};

    // TODO check if the redis connection was successful before attempting to query the redis server

    //'__keyevent@*:*'
    function init() {
        // Turn on notify events for:
        // E: Keyspace events
        // z: Sorted sets
        listener.rawCall(['config', 'set', 'notify-keyspace-events', 'Ez']);

        // Allows other machine to access redis clients on this one.
        listener.rawCall(['config', 'set', 'protected-mode', 'no']);
        executor.rawCall(['config', 'set', 'protected-mode', 'no']);
        broadcaster.rawCall(['config', 'set', 'protected-mode', 'no']);

        //listen for all events for all keys and process them in the listenerEvent function
        listener.rawCall(['psubscribe', '__keyevent*'], listenerEvent);
    }

    function listenerEvent(e, data) {
        if (e) {
            if (debug) {
                console.log('RECEIVE-ERROR', e);
            }
        } else {
            if (data[3] == undefined) {
                // This means from the server ...
            } else if (data[0] == "pmessage") {
                //console.log(data);
                if (data[3].indexOf("JSHUFFLER") >= 0) {
                    if (debug) {
                        console.log("Shuffler event received ... Ignoring ...");
                        console.log('RECEIVED', data, ' from keyword ', data[3]);
                    }
                    return;
                } else if (data[3].indexOf("COMMAND_LOGGER") >= 0) {
                    if (debug) {
                        console.log("Activity Log event received ... Ignoring ...");
                        console.log('RECEIVED', data, ' from keyword ', data[3]);
                    }
                    return;
                }

                if (debug) {
                    console.log('RECEIVED', data, ' from keyword ', data[3]);
                }


                if (jamdatastream_callbacks[data[3]] != undefined) {
                    // msg_receive_callback(data);
                    var jamdatastream = jamdatastream_callbacks[data[3]];
                    jamdatastream.set_size++;
                    if (jamdatastream.refresh_rate == 0) {
                        jamdatastream.request_value_refresh();
                    }
                } else {
                    var idx = data[3].lastIndexOf('.');
                    if (idx !== -1) {
                        var jamdatasource_key = data[3].substring(0, idx);
                        var jamdatasource = jamdatasources[jamdatasource_key];
                        if (jamdatasource != undefined) {
                            idx = data[3].lastIndexOf('[');
                            var deviceId = data[3].substring(idx + 1, data[3].length - 1);
                            jamdatasource.addDatastream(deviceId);
                            var jamdatastream = jamdatastream_callbacks[data[3]];
                            jamdatastream.set_size++;
                            if (jamdatastream.refresh_rate == 0) {
                                jamdatastream.request_value_refresh();
                            }
                        }
                    }
                }

                //Added by Richboy on Sat 3 June 2017
                //notify all listeners for this message on the current key
                if( listeners[data[3]] ){   //there are listeners listening on this key
                    var keyObject = buildKeyObject(data[3]);

                    for( let listener of listeners[data[3]] ){
                        if( listener.notify && typeof listener.notify === 'function' )
                            listener.notify.call(listener, keyObject);
                        else if( typeof listener === 'function' )
                            listener.call({}, keyObject);
                    }
                }
            }
        }
    }

    //Added by Richboy on Sat 3 June 2017
    //Used to build subscription key for Apps that subscribe with Objects
    function buildKey(obj){
        var key = 'apps[' + obj.app + ']';
        if( obj.namespace )
            key = key + '.namespaces[' + obj.namespace + ']';
        if( obj.flow )  //for OutFlow and InFlow
            key = key + '.flow[' + obj.flow + ']';
        if( obj.datasource )
            key = key + '.datasources[' + obj.datasource + ']';
        if( obj.datastream )
            key = key + '.datastreams[' + obj.datastream + ']';

        return key;
    }

    //Added by Richboy on Sat 3 June 2017
    //Used to rebuild subscription key back to Objects
    function buildKeyObject(key){
        var obj = {}, content;

        var parts = key.split(".");

        for( let part of parts ){
            content = part.substring(part.indexOf("[") + 1, part.indexOf("]"));

            if( part.startsWith("app") )
                obj.app = content;
            else if( part.startsWith("namespace") )
                obj.namespace = content;
            else if( part.startsWith("flow") )
                obj.flow = content;
            else if( part.startsWith("datasource") )
                obj.datasource = content;
            else if( part.startsWith("datastream") )
                obj.datastream = content;
        }

        return obj;
    }

    init();

    return {
        broadcastMessage: function(domain, message) {
            // "JBROADCAST:" + domain
            setTimeout(function() {
                var namespace = 'global';
                var name = domain;
                var parts = domain.split('.');
                if (parts.length > 1) {
                    namespace = parts[0];
                    name = parts[1];
                }
                domain = 'apps[' + app + '].namespaces[' + namespace + '].broadcasters[' + name + ']';
                console.log('Broadcasting ' + message + ' to domain ' + domain + '\n');
                broadcaster.rawCall(['PUBLISH', domain, message]);
            }, 30);
        },

        add_jamdatasource: function(jamdatasource) {
            if (jamdatasource == undefined) {
                throw new Error("Undefined jamdatasource");
            }
            jamdatasources[jamdatasource.key] = jamdatasource;
        },

        add_jamdatastream: function(jamdatastream) {
            if (jamdatastream == undefined) {
                throw new Error("Undefined jamdatastream");
            }
            jamdatastream.redis = new Redis({
                "host": host,
                "port": 6379
            });
            jamdatastream_callbacks[jamdatastream.key] = jamdatastream;
        },

        // Used to delete the old key when a new key for a datastream is set
        delete_jamdatastream: function(key){
            if( jamdatastream_callbacks[key] )
                delete jamdatastream_callbacks[key];
        },

        log: function(key, value, slots, appID, deviceID) {
            // check if we already have a key saved in the array

            var jamdatastream;

            if (jamdatastreams[key]) { // we have added this key before
                jamdatastream = jamdatastreams[key].jamdatastream;
            } else { // a new key
                jamdatastream = new JAMDatastream(key, slots, executor);
                jamdatastreams[key] = jamdatastream;
            }

            jamdatastream.log(value, function(resp) {
                // resp is an object with 'status' and based on the status state, we could have error (if process failed),
                // or message (if process was successful)
            });
        },

        //Added by Richboy on Sat 3 June 2017
        simpleLog: function(key, value, callback, redis){
            if( !redis )
                redis = this.redis;

            //check if the key is an object
            if( Boolean(key) && typeof key === 'object' )   //convert the key to string
                key = buildKey(key);

            if( Boolean(value) && typeof value === 'object' )   //convert the value to string
                value = JSON.stringify(value);

            redis.rawCall(["EVAL", "redis.replicate_commands();" +
            "local t = (redis.call('TIME'))[1];" +
            "redis.call('ZADD', KEYS[1], t, ARGV[1]);" +
            "return {t}", 1, key, value], function(e, d) {
                if (e) {
                    if (callback) {
                        callback({
                            status: false,
                            error: e
                        });
                    }
                }
                else if (callback) {
                    setTimeout(function() {
                        callback({
                            status: true,
                            message: 'Process Completed Successfully!',
                            timestamp: d[0] - 0
                        });
                    }, 0);
                }
            });
        },

        //Added by Richboy on Sat 3 June 2017
        subscribe: function(key, listener){
            //check if the key is an object
            if( Boolean(key) && typeof key === 'object' )   //convert the key to string
                key = buildKey(key);

            if( listeners[key] )
                listeners[key].push(listener);
            else
                listeners[key] = [listener];
        },

        //Added by Richboy on Sat 3 June 2017
        unsubscribe: function(key, listener){
            //check if the key is an object
            if( Boolean(key) && typeof key === 'object' )   //convert the key to string
                key = buildKey(key);

            if( listeners[key] ){
                var i = 0;
                for( let l of listeners[key] ){
                    if( l == listener )
                        listeners[key].splice(i, 1);
                    i++;
                }
            }
        },

        buildKey: buildKey, //Added by Richboy on Sat 3 June 2017

        buildKeyObject: buildKeyObject, //Added by Richboy on Sat 3 June 2017

        getRedisHost() {
            return host;
        },

        getRedisPort() {
            return port;
        },

        app: app,
        redis: executor,
        delimiter: "$$$",
        parentRedis: parentRedis,

        /**
         * This method tries to connect to the redis of the parent of the current level in the hierarchy.
         */
        connectToParent(ip, port){
            parentRedis = new Redis({
                host: ip,
                port: port
            });

            return parentRedis;
        }
    };
})(host, 6379);
