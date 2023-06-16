jdata {
    float test_float as logger;
    int test_int as logger;
	char * test_string as logger;
}

var string_logger = test_string.getMyDataStream();
var float_logger = test_float.getMyDataStream();
var int_logger = test_int.getMyDataStream();

var icount = 10,
	fcount = 105.4;

setInterval(function () {

	console.log("Size of logger ", test_int.size());

	if (jsys.type === "cloud") {
		string_logger.log("fred@cloud");
		int_logger.log(icount);
		float_logger.log(fcount);
	} else if (jsys.type === "fog") {
		string_logger.log("fred@fog");
		int_logger.log(icount);
		float_logger.log(fcount);
	} else {
		string_logger.log("fred@device");
		int_logger.log(icount);
		float_logger.log(fcount);
	}

	icount++;
	fcount = fcount + Math.random() * 100;

	for (i = 0; i < test_int.size(); i++) {
		if (test_int[i] !== undefined && test_int[i].lastValue() != null) 
			console.log('--i: ', i, 'value: ', test_int[i].lastValue(), 'devID: ', test_int[i].getDeviceId());
		if (test_float[i] !== undefined && test_float[i].lastValue() != null)
			console.log('--i: ', i, 'value: ', test_float[i].lastValue(), 'devID: ', test_float[i].getDeviceId());
		if (test_string[i] !== undefined && test_string[i].lastValue() != null)
			console.log('--i: ', i, 'value: ', test_string[i].lastValue(), 'devID: ', test_string[i].getDeviceId());
	}
}, 500);
