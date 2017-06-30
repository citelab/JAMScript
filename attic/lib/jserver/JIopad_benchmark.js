var JAMIopad = require('./jamiopad.js'),
    JAMDatastream = require('./jamdatastream.js');
var iopad = new JAMIopad(undefined, 'test_iopad'),
    date  = new Date(),
    count = 900,
    datastream,
    devId = 0,
    key   = 0,
    value = 0,
    data;
while(devId < count){
    datastream = new JAMDatastream(devId, key, true, undefined, undefined, 0);
    key = 0;
    while(key < count) {
        value = 0;
        while (value < count) {
            data = {log: value, timestamp: date.getTime()};
            iopad.addDataToStream(data, devId, key);
            value ++;
        }
        key ++;
    }
    devId++;
}
console.log('Writing data to the iopad is done!');
process.exit(0);

