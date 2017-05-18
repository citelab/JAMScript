var Redis = require('redis-fast-driver');

var r = new Redis({
    //host: '/tmp/redis.sock', //unix domain
    host: '127.0.0.1', //can be IP or hostname
    port: 6379
});


//happen only once
r.on('ready', function(){
    console.log('redis ready');
});

//happen each time when reconnected
r.on('connected', function(){
    console.log('redis connected');
});

r.on('disconnected', function(){
    console.log('redis disconnected');
});

r.on('error', function(e){
    console.log('redis error', e);
});

var date  = new Date(),
    count = 1,
    value, data;
while(count <= 1048576){
    console.log('\n#data = ', count);
    value = 1;
    console.time();
    while(value <= count){
        r.rawCall(['zadd', 'storage', date.getTime(), value], function(err, resp){
            console.log('err: ', err, ' resp: ', resp);
        });
        value ++;
    }
    console.timeEnd();
    count *= 2;
}
module.exports = r;

