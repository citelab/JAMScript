//===========================================
// error handling
//===========================================

// Private
var bunyan = require('bunyan');

// Public
module.exports = {

    log: null,

    init: function(app) {
        module.exports.log = bunyan.createLogger({
            name: app,
            streams: [{
                path: './logs/log.log'
            },
            {
                stream: process.stderr
            }]
        });
    }
}
