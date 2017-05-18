var r = require('./speed_writing.js'),
    date = new Date(),
    value, count = 1;
while(count <= 1048576){
    console.log('\n#data = ', count);
    value = 1;
    while(value < count){
        r.rawCall(['zrange', 'storage', 0, value], function(err, response){
            if(err) console.log('error');
        });
        value ++;
    }  
    count *= 2;  
}


