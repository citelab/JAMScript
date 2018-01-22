jdata {
    float zz as logger;
    int qq as logger;
    char *ss as logger;
}

var slogger = ss.getMyDataStream();

setInterval(function() {

	console.log("Size of logger ", qq.size());

	//		if (jsys.type === "cloud")
	//		    slogger.log("fred@cloud");
	//		else if (jsys.type === "fog")
	//    slogger.log("fred@fog");
	//else 
	//    slogger.log("fred@device");

	for (i = 0; i < qq.size(); i++) {
	    //    if (qq[i] !== undefined && qq[i].lastValue() != null) 
		console.log('--i: ', i, 'value: ', qq[i].lastValue(), 'devID: ', qq[i].getDeviceId());
		//	    if (zz[i] !== undefined && zz[i].lastValue() != null)
		console.log('--i: ', i, 'value: ', zz[i].lastValue(), 'devID: ', zz[i].getDeviceId());
		//	    if (ss[i] !== undefined && ss[i].lastValue() != null)
		console.log('--i: ', i, 'value: ', ss[i].lastValue(), 'devID: ', ss[i].getDeviceId());

	}
    }, 500);
