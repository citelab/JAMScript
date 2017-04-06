/**
 * This file listens for events in the key space and takes the required action. It also
 */

var Redis = require('redis-fast-driver');
var JAMDatastream = require('./jamdatastream.js');

var jamdatastream_callbacks = [];
var jamdatasources = {};
var initalizing = true;
var debug = false;

const cmdParser = require('./cmdparser.js');
var app = cmdParser().app || 'DEFAULT_APP';

module.exports = (function(host, port) {
    /**
     * Each element in the jamdata is a pair of key => jamdatastream.
     * Sample: key: jamdatastream: ...
     * key is the unique key which would receive the storage elements or act as the subscription handle/tag
     * object is a JAMDatastream object
     * @type {Object}
     */
    var jamdatastreams = {};
    var msg_receive_callback = undefined;

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

    // TODO check if the redis connection was successful before attempting to query the redis server

    //'__keyevent@*:*'
    function init() {
        //listen for all events for all keys and process them in the listenerEvent function
        listener.rawCall(['psubscribe', '__keyevent*'], listenerEvent);
    }

    function listenerEvent(e, data) {
        var jamdatastream;

        if (e) {
            if (debug) {
                console.log('RECEIVE-ERROR', e);
            }
        } else {
            if (data[3] == undefined) {
                // This means from the server ...
            } else if (data[0] == "pmessage") {
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
            }
        }
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
            jamdatastream_callbacks[jamdatastream.key] = jamdatastream;
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

        getRedisHost() {
            return host;
        },

        getRedisPort() {
            return port;
        }
    };
})('127.0.0.1', 6379);
