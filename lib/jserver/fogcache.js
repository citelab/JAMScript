//===================================================================
// This module holds the Fog Up Cache. By inspecting this Cache
// we can get to know the fogs that are currently working.
// We are using the fog up/down notifications to maintain the
// cache.
//
//===================================================================
var globals = require('./constants').globals;

var store = {};

module.exports = new function() {

    this.up = function(id, info) {
        store[id] = info;
    }

    this.down = function(id) {
        delete(store[id]);
    }

    this.isUp = function(id) {
        if (store[id])
            return true;
        else
            return false;
    }

    this.getinfo = function(id) {
        return store[id];
    }
}
