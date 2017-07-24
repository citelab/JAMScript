jdata{
	struct weather{
		int highTemperature;
		int lowTemperature;
		float humidity;
		float wind;
		char* airQuality;
		char* UV;
	} MTLWeather as logger;

	char* sensorStatus as logger;

	stats as flow with statsFunc of MTLWeather; 
}


var hotDays = function(inputFLow){
	return inputFLow.where(weather => weather.maxTemperature>=35);
};

var windyDays = function(inputFLow){
	return inputFLow.where()
};

var weeklyStats = function(inputFLow, n){
	startingDate = (n-1)*7;
	endingDate = startingDate+6;

	return stats.range(inputFLow, n);
};

var periodStats = function(inputFLow, startingDate, endingDate){
	if(startingDate == undefined)
		return inputFLow.limit(0, endingDate-1);
	if(endingDate == undefined)
		return inputFLow.skip(startingDate-1);
	if(startingDate == undefined && endingDate == undefined)
		return inputFLow;
	return inputFLow.range(startingDate-1, endingDate-1);
};

var incOrderBy = function(inputFLow, property){

	return inputFLow.orderBy(function(a, b){
		if(a[property] < b[property])
			return -1;
		if(a[property] > b[property])
			return 1;
		return 0;
	});
};

var decOrderBy = function(inputFLow, property){

	return inputFLow.orderBy(function(a, b){
		if(a[property] < b[property])
			return 1;
		if(a[property] > b[property])
			return -1;
		return 0;
	});
};

var incOrderByProp = function(inputFLow, property){
	
	var propertyFlow = inputFLow.select(function(weather){ 
		return weather[property];
	});

	return propertyFlow.orderBy();
};

var decOrderByProp = function(inputFLow, property){
	
	var propertyFlow = inputFLow.select(function(weather){ 
		return weather[property];
	});

	return propertyFlow.orderBy(function(a,b){
		if(a<b) return 1;
		if(a>b) return -1;
		return 0;
	});
};

var toFahrenheit = function(inputFLow){

	return inputFLow.select(function(weather){
		var result = weather;
		result.maxTemperature = weather.maxTemperature * 1.8 + 32;
		result.minTemperature = weather.minTemperature * 1.8 + 32;
		return result;
	});
};

// returns a flow contains both the low and high temperature
// that is incrementally ordered
var incOrderByTemp = function(inputFLow){

	return inputFLow.selectExpand(function(weather){
		return [weather.lowTemperature, weather.highTemperature];
	}).orderBy();
};







