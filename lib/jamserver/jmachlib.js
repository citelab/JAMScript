// jmachlib.js

const globals = require('jamserver/constants').globals;


var jsys;
var cmdopts;


module.exports = new function() {
    this.run = run;
    this.getjsys = getjsys;
    this.getcmdopts = getcmdopts;
}

function setupMachlib() {

    // Setup Machine Learning Library
}

function getjsys() {
    return jsys;
}

function getcmdopts() {
    return cmdopts;
}


function run(callback) {

    onmessage = function(ev) { 
        var v = ev.data;
        switch (v.cmd) {
            case 'CONF-DATA':
                switch (v.opt) {
                    case 'CMDOPTS':
                        cmdopts = v.data;
                    break;
                    case 'JSYS':
                        jsys = v.data; 
                        setupMachlib();
                        // This is running the actual machine learner module
                        if (callback !== undefined)
                            callback();
                    break;
                }
                postMessage({cmd: 'DONE'});
            default:
        }
    }    
}
