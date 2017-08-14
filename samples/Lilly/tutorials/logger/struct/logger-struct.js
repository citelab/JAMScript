jdata{
	struct weather{
		int temperature;
		float humidity;
		float wind;
		char* airQuality;
		char* UV;
	} MTLWeather as logger;
}

var notify = function(key, entry, device){
	var size = device.size();
	console.log("Logging the "+size+"-th data "+entry+" into logger "+" key");

	var lastData = device.lastData();
	console.log("Last data received",lastData);

	var lastValue = device.lastValue();
	console.log("Last value received",lastValue);

	var data = device.data();

	var values = device.values();

	if(device.size()>=10){
		var last10Data = device.n_data(10);
		console.log("Last 10 data received",last10Data);
	}

	if(device.size()>=10){
		var last10Values = device.n_values(10);
		console.log("Last 10 values received",last10Values);
	}


	if(device.size()>20){
		// get the 21th value received
		var aValue = device.get_value_at(20);
	}

	if(device.size()>20){
		// get the 10 values starting from the 6th one received
		var someValue = device.get_range_values(5, 10);
	}

	// year, month-1, date, hour, minute, secod
	var today = new Date(2017, 7, 14, 0, 0, 0);

	var dataToday = device.dataAfter(today);
	var valuesToday = device.valuesAfter(today);
	console.log("Received "+valuesToday.length+" data today");
	
	var yesterday = new Date(2017, 7, 13, 0, 0, 0);

	var dataYesterday = device.dataBetween(today, yesterday);
	var valueYesterday = device.valuesBetween(today, yesterday);
	console.log("Received "+valueYesterday.length+" data yesterday");
}

MTLWeather.subscribe(notify);