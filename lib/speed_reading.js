var JAMDatasource = require('./jamdatasource.js'),
    JAMDatastream = require('./jamdatastream.js'),
    JAMIopad = require('./jamiopad.js');

var iopad = new JAMIopad(undefined, 'test_iopad'),
    date  = new Date(),
    count = 1,
    devId = 'device',
    key   = 'key',
    value = 0,
    data;
console.log('\n#data = ', count);
while(value < count){
    data = iopad.lastDataInStream(devId, key);
    console.log(data.log, ' ', data.timestamp);
    value ++;
}
//console.log('Writing data to the iopad is done!');
process.exit(0);

