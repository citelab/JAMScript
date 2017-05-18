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
    count = process.argv[2],
    value = 1,
    data;
console.log('\n#data = ', count);
while(value <= count){
    r.rawCall(['zadd', 'storage', date.getTime(), value], function(err, resp){
    	console.log('err: ', err, ' resp: ', resp);
    });
    value ++;
}
//process.exit(0);