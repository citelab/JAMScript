//===========================================
// error handling
//===========================================

// Private
var bunyan = require('bunyan');

// Public
module.exports = {

    log: null,

    init: function(app) {
        module.exports.log = bunyan.createLogger({name: app});
    }
}
