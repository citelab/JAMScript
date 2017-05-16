require('jamiopad.js');
require('jamdatastream.js');
const jammanager = require('./jammanager');
var iopad = new JAMIopad(jammanager, 'test_iopad'),
    Date  = new Date(),
    count = 100,
    datastream,
    devId = 0,
    key   = 0,
    value = 0,
    data;
while(devId < count){
    while(key < count) {
        datastream = new JAMDatastream(devId, key, true, jammanager, undefined, 0);
        while (value < count) {
            data = {log: value, timestamp: Date.getTime()};
            iopad.addDataToStream(data, devId, key);
            value ++;
        }
        key ++;
    }
    devId++;
}