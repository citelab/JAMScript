//===================================================================
// This module holds the Fog Up Cache. By inspecting this Cache
// we can get to know the fogs that are currently working.
// We are using the fog up/down notifications to maintain the
// cache.
//
//===================================================================
var globals = require('./constants').globals;

var store = new Map();

module.exports = new function() {

    this.fogup = function(id, info) {
        store.set(id, {type: 'fog', val: info});
    }

    this.cloudup = function(id, info) {
        store.set(id, {type: 'cloud', val: info});
    }

    this.down = function(id) {
        store.delete(id);
    }

    this.getinfo = function(id) {
        entry = store.get(id);
        if (entry !== undefined)
            return entry.val;

        return undefined;
    }

    this.getfog = function() {

        store.forEach(function(value, key, map) {
            if (value !== undefined && value.type === 'fog')
                return value;
        });

        return undefined;
    }

}
