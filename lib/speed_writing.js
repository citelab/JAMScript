const JAMDatasource = require("./jamdatasource.js"),
      JAMDatastream = require('./jamdatastream.js'),
      JAMIopad = require('./jamiopad.js');

var iopad = new JAMIopad(undefined, 'test_iopad'),
    date  = new Date(),
    count = process.argv[2],
    devId = 'device1',
    key   = 'key',
    value = 0,
    data;
console.log(typeof devId);
iopad.addDatastream(devId);
var datastream = iopad[devId];
console.log('\n#data = ', count);
console.log('datastream.key = ', datastream.key, '\niopad.key = ', iopad.key);
while(value < count){
    data = {log: value, timestamp: date.getTime()};
    iopad.addDataToStream(data, devId, datastream.key);
    value ++;
}

process.exit(0);

