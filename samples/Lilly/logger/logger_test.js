jdata {
	int t as logger;
    struct fruit{
    	int apple;
    	float pear;
    } s as logger;
}

setInterval(function() {
	if (t[0] !== undefined && !t[0].isEmpty()){
		console.log(t[0].lastValue());
	}
    if (s[0] !== undefined && !s[0].isEmpty()) {
        console.log(s[0].lastValue());
    }
}, 1000);
