jdata{
	sensorStatus as inflow of app://t.outF;

	struct weather{
		int date;
		int highTemperature;
		int lowTemperature;
		float humidity;
		float wind;
		char* airQuality;
		char* UV;
	} MTLWeather as logger;

	stats as flow with statsFunc of MTLWeather; 
}

function statsFunc(inputFlow){
	return inputFlow;
}

var sensor = -1;

sensorStatus.setTerminalFunction(function(entry){
	if(entry.data == 1 && sensor == -1){
		sensor = 1; 
		console.log("*************************************SENSOR IS UP***************************************");
		(function poll(){
		    if( MTLWeather.size() < 1 ){
		        console.log("waiting for a C-node");
		        setTimeout(poll, 1000);
		    }
		    else
		        stats.startPush();
		})();
	}
	else if(entry.data == 0){
		sensor = -1;
		console.log("*************************************SENSOR IS DOWN***************************************");
		stats.stopPush();
	}
});

stats.setTerminalFunction(function(entry){
	console.log("Weather:",entry.data);
});



