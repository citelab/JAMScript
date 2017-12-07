'use strict';

const JAMDatastream = require('./jamdatastream');
const cmdopts = require('./cmdparser');
const jamsys = require('./jamsys');

class JAMDatasource {

    // type - data source type (string; logger, filter, or transformation)
    // name - data source name (string; optionally prefixed with namespace)
    // source - dev, fog, or cloud
    // destination - dev, fog, or cloud
    constructor(jammanager, type, name, source, destination) {
        this.jammanager = jammanager;
        this.type = type;
        this.source = source;
        this.destination = destination;
        this.app = cmdopts.app || 'APP';

        // name and namespace
        var name = name || 'name0';
        var parts = name.split('.');
        if (parts.length === 2) {
            this.namespace = parts[0];
            this.name = parts[1];
        } else {
            this.namespace = 'global';
            this.name = name;
        }

        // datastreams
        this.num_datastreams = 0;

        this.key = 'aps[' + this.app + '].ns[' + this.namespace + '].ds[' + this.name + ']';
        if (jammanager) {
            jammanager.add_jamdatasource(this);
        }

        this.listeners = [];
    }

    // public API

    /*
     size()

     Returns the number of data streams in a data source (logger, filter, or transformation).

     Example:
     jdata {
     double x as logger;
     }
     console.log(x.size()); // logger x contains 3 data streams (from 3 devices)
     3
     */
    size() {
        return this.num_datastreams;
    }

    // internal implementation

    getApp() {
        return this.app;
    }

    getDeviceId() {
        return this.dev_id;
    }

    getNamespace() {
        return this.namespace;
    }

    getName() {
        return this.name;
    }

    getType() {
        return this.type;
    }

    getDataType(){
        return this.dataType;
    }

    setDataType(dt){
        this.dataType = dt;
    }

    addDatastream(dev_id) {
        var key = this.buildKey(dev_id);
        this[this.num_datastreams] = new JAMDatastream(dev_id, key, false, this.jammanager);
        this[this.num_datastreams].setDatasource(this);

        //subscribe all listeners to this datastream
        for(var i = 0; i < this.listeners.length; i++){
            this[this.num_datastreams].subscribe(this.listeners[i]);
        }

        this.num_datastreams++;
        return this[this.num_datastreams-1];
    }

    // returns undefined if there is stream for this device.
    getMyDataStream() {
        var dev_id = jamsys.fullid();

        for(var i = 0; i < this.size(); i++){
            if (this[i].getDeviceId() === dev_id)
                return this[i];
        }
    }

    addMyDataStream() {
        var dev_id = jamsys.fullid();

        var ds = this.getMyDataStream();
        if (ds !== undefined)
            return ds;

        return this.addDatastream(dev_id);
    }


    getDestination(){
        return this.destination;
    }

    buildKey(dev_id) {
        var key = 'aps[' + this.app + '].' +
            'ns[' + this.namespace + '].' +
            'ds[' + this.name + '].' +
            'dts[' + dev_id + ']';
        return key;
    }

    subscribe(listener){
        this.listeners.push(listener);

        //subscribe to all datastreams for this datasource
        for(var i = 0; i < this.size(); i++){
            this[i].subscribe(listener);
        }
    }

    unsubscribe(listener){
        for( let i = 0; i < this.listeners.length; i++ ){
            if( this.listeners[i] == listener ){
                //unsubscribe from all datastreams for this datasource
                for(var j = 0; j < this.size(); j++){
                    this[j].unsubscribe(listener);
                }

                this.listeners.splice(i, 1);
                break;
            }
        }
    }

    toIterator(){
        return (function(self){
            var pos = 0;
            var length = self.size();

            return {
                [Symbol.iterator]: () => this,
                next(){
                    return pos < length ? {value: self[pos++], done: false} : {done: true};
                }
            };
        })(this);
    }
}

module.exports = JAMDatasource;
