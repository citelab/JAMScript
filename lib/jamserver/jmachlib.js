// jmachlib.js
const ebus = require('jamserver/ebus');

var jsys;
var cmdopts;

module.exports = new function() {
    this.run = run;
    this.getjsys = getjsys;
    this.getcmdopts = getcmdopts;
    this.loop = loop;
}

function setupMachlib() {

    // Setup Machine Learning Library
    console.log("Setting up mach.........");

}

function getjsys() {
    return jsys;
}

function getcmdopts() {
    return cmdopts;
}

function loop(jman, jbcast, jlog) {

    if (jsys.type === "cloud") {

        setInterval( function () {
            jbcast.broadcast("Hello");
            console.log('Publishing... ');
        }, 200);

    } else if (jsys.type === "fog") {

        jbcast.addHook(function (x) {
            console.log("Received... ", x);
        })

    } else {

    }

}

function run(callback) {

    onmessage = function(ev) { 
        var v = ev.data;
        switch (v.cmd) {
            case 'NCACHE-MOD':
                switch (v.opt) {
                    case 'FOG-DATA-UP':
                        ebus.fogDataUp(v.data);
                    break;
                    case 'FOG-DATA-DOWN':
                        ebus.fogDataDown();
                    break;

                    case 'CLOUD-DATA-UP':
                        ebus.cloudDataUp(v.data);
                    break;

                    case 'CLOUD-DATA-DOWN':
                        ebus.cloudDataDown();
                    break;
                }
                postMessage({cmd: 'DONE'});
            break;
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
