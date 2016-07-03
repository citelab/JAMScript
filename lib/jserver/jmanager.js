/**
 * Created by richboy on 15/06/16.
 *
 * This file listens for events in the key space and takes the required action. It also
 */

var Redis = require('redis-fast-driver');
//var JBroadcaster = require('./jbroadcaster.js');
var JLogger = require('./jlogger.js');

module.exports = (function(host, port){
    /**
     * Each element in the jamdata is a pair of key => logger.
     * Sample: key: logger: ...
     * key is the unique key which would receive the storage elements or act as the subscription handle/tag
     * object is a JLogger object
     * @type {Object}
     */
    var loggers = {};

    //this is the redis instance that would be sent to all broadcast domains...
    //and would be used to broadcast messages to all subscribed
    var broadcaster = new Redis({
        host: host,
        port: port
    });

    //this would listen for all keyspace events (using the keyevent notification mechanism) and channel it to the right
    var listener = new Redis({
        host: host,
        port: port
    });

    //this is the handle that would be passed to all instances of the JLogger for making a call to the Redis server
    var executor = new Redis({
        host: host,
        port: port
    });

    //TODO check if the redis connection was successful before attempting to query the redis server

    //'__keyevent@*:*'
    function init(){
        //listen for all events for all keys and process them in the listenerEvent function
        //listener.rawCall(['psubscribe', '__keyevent*'], listenerEvent);
    }

    function listenerEvent(e, data){
        var logger;
        
        if( e )
            console.log('RECEIVE-ERROR', e);
        else
            console.log('RECEIVED', data);

        //channel event to the correct key
        if( data[0] == "pmessage" ){//check if this event corresponds to a message event
            //get the key and event-action that occurred
            var eventKey = data[data.length - 1];
            var eventAction = data[data.length - 2].split("__:")[1];
            
            //check if the key exists in the loggers
            if( (logger = loggers[eventKey]) );
            else {
                //TODO because this key wasn't reported to JManager/JNode, the number of slots is current not bounded.
                //We probably need to implement a scheme that will enable the JNode to retrieve the bound/number of entries
                logger = new JLogger(eventKey, -1, executor);
                loggers[eventKey] = logger;
            }

            logger.processEvent(eventAction);
        }
    }

    init();


    return {
        broadcastMessage: function(domain, message){
            //"JBROADCAST:" + domain
            broadcaster.rawCall(['PUBLISH', "JBROADCAST:" + domain, message]);
        },
        log: function(key, value, slots, appID){
            //check if we already have a key saved in the array
            //TODO we may have to qualify the key later with the Application ID

            var logger;

            if( loggers[key] )//we have added this key before
                logger = loggers[key].logger;
            else{//a new key
                logger = new JLogger(key, slots, executor);
                loggers[key] = logger;
            }

            logger.log(value, function(resp){
                //resp is an object with 'status' and based on the status state, we could have error (if process failed),
                //or message (if process was successful)
            });
        }
    };
})('127.0.0.1', 6379);