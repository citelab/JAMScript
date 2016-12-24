
module.exports = function (fname) {

    if (typeof localStorage === "undefined" || localStorage === null) {

        var LocalStorage = require('node-localstorage').LocalStorage;
        localStorage = new LocalStorage(fname);
    }
    
    var conf = {};
    if (localStorage.getItem('deviceID') === null) {
        console.log("DeviceID not defined..");
        conf["deviceId"] = "CCCCCCDDDSDSDSD";
        localStorage.setItem('deviceID', conf["deviceId"]);
    } else
        console.log("DeviceID is defined..", );

}


