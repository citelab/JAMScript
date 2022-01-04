jdata {
    float zz as logger;
    int qq as logger;
    char *ss as logger;
}

var slogger = ss.getMyDataStream();
var zlogger = zz.getMyDataStream();
var qlogger = qq.getMyDataStream();

var icount = 10,
    fcount = 105.4;

setInterval(function() {

	console.log("Size of logger ", qq.size());

    if (jsys.type === "cloud") {
	slogger.log("fred@cloud");
	qlogger.log(icount);
	zlogger.log(fcount);
    } else if (jsys.type === "fog") {
	slogger.log("fred@fog");
	qlogger.log(icount);
	zlogger.log(fcount);
    } else {
	slogger.log("fred@device");
	qlogger.log(icount);
	zlogger.log(fcount);
    }

    icount++;
    fcount = fcount + Math.random() * 100;

    for (i = 0; i < qq.size(); i++) {
	//    if (qq[i] !== undefined && qq[i].lastValue() != null) 
	console.log('--i: ', i, 'value: ', qq[i].lastValue(), 'devID: ', qq[i].getDeviceId());
	//	    if (zz[i] !== undefined && zz[i].lastValue() != null)
	console.log('--i: ', i, 'value: ', zz[i].lastValue(), 'devID: ', zz[i].getDeviceId());
	//	    if (ss[i] !== undefined && ss[i].lastValue() != null)
	console.log('--i: ', i, 'value: ', ss[i].lastValue(), 'devID: ', ss[i].getDeviceId());

    }
}, 500);
