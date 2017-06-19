jdata {
    int x as logger;
    struct {
	int y;
	float f;
    } s as logger;
}

setInterval(function() {

    if (x[0] !== undefined && !x[0].isEmpty()) {
        console.log(x[0].lastValue());
    }

    if (s[0] !== undefined && !s[0].isEmpty()) {
        console.log(s[0].lastValue());
    }

}, 1000);
