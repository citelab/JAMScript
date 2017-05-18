var r = require('./speed_writing.js').r,
    value = 1,
    date  = new Date(),
    count = process.argv[2];
console.log('\n#data = ', count);
while(value < count){
    r.rawCall(['zrange', 'storage', 0, value], function(err, response){
        if(err) console.log('error');
        console.log('data = ', response);
    });
    value ++;
}
//process.exit(0);

