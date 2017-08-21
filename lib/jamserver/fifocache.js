//===================================================================
// This is a simple FIFO cache. It maintains the last N distinct
// elements seen at the module.
// The oldest element is removed when additional space is required.
// It is not very efficient - just simple!
//
//===================================================================
var globals = require('./constants').globals;

var cache = [];

module.exports = new function() {

    this.duplicate = function(id) {
        if (cache.includes(id))
            return true;

        cache.push(id);
        if (cache.length > globals.Cache.LIMIT)
            cache.shift();
        return false;
    }

    this.flush = function() {
        cache = [];
    }
}
