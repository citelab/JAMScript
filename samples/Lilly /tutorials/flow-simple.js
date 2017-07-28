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

/* The flow comes 
 *
 */
function statsFunc(inputFlow){
	return inputFlow.discretize(1, 31);
}

stats.setTerminalFunction(function(f){

	console.log("**********************************Monthly Statistics**********************************");
	//f.shouldCache = false; // this line will make week1.count() be 0
	f.count();
	var month = f.selectFlatten();
	prettyPrint(month);

	var hot1 = f.selectFlatten().select(entry => entry.data).where((weather) => weather.highTemperature>=60);
	var hot2 = month.select(entry => entry.data).where((weather) => weather.highTemperature>=60);
	console.log("hot1", hot1.count());
	console.log("hot2", hot2.count());

	console.log("**********************************Weekly Statistics***********************************");

	console.log("***************************************Week 1*****************************************");
	f.count();
	var week1 = weeklyStats(f, 1);
	console.log("Week1 hot days:",week1.select(entry => entry.data).where((weather) => weather.highTemperature>=60).count());
	prettyPrint(week1);
	//hotDays(week1);
	console.log("week1 hot days:", hotDays(week1).count());

	console.log("***************************************Week 2*****************************************");
	f.count();
	var week2 = weeklyStats(f, 2);
	prettyPrint(week2);
	//console.log("week2 hot days:", hotDays(week2).count());

	console.log("***************************************Week 3*****************************************");
	f.count();
	var week3 = weeklyStats(f, 3);
	prettyPrint(week3);
	//console.log("week3 hot days:", hotDays(week3).count());

	console.log("***************************************Week 4*****************************************");
	f.count();
	var week4 = weeklyStats(f, 4);
	prettyPrint(week4);
	console.log("week4 hot days:", hotDays(week4).count());

	var incByHighTemp = incOrderBy(f, "highTemperature");
	prettyPrint(incByHighTemp);
});

(function poll(){
    if( MTLWeather.size() < 1 ){
        console.log("waiting for a C-node");
        setTimeout(poll, 2000);
    }
    else
        stats.startPush();
})();

function prettyPrint(discretizedFlow){
	
	var size1 = String("|  highTemperature  ").length,
		size2 = String("|  lowTemperature  ").length,
		size3 = String("|  humidity  ").length,
		size4 = String("|  wind  ").length,
		size5 = String("|  airQuality  ").length,
		size6 = String("|  UV  ").length;

	console.log("|  highTemperature  |  lowTemperature  |  humidity  |  wind  |  airQuality  |  UV  |");

	discretizedFlow.foreach(function(weather){
		weather = weather.data;
		var sizeDiff;

		var s1 = "|  "+String(weather.highTemperature);
		sizeDiff = size1-s1.length;
		for(var i=0;i<sizeDiff;i++){
			s1+=" ";
		}
		

		var s2 = "|  "+String(weather.lowTemperature);
		sizeDiff = size2-s2.length;
		for(i=0;i<sizeDiff;i++){
			s2+=" ";
		}

		var s3 = "|  "+String(weather.humidity);
		sizeDiff = size3-s3.length;
		for(i=0;i<sizeDiff;i++){
			s3+=" ";
		}

		var s4 = "|  "+String(weather.wind);
		sizeDiff = size4-s4.length;
		for(i=0;i<sizeDiff;i++){
			s4+=" ";
		}

		var s5 = "|  "+String(weather.airQuality);
		sizeDiff = size5-s5.length;
		for(i=0;i<sizeDiff;i++){
			s5+=" ";
		}

		var s6 = "|  "+String(weather.UV);
		sizeDiff = size6-s6.length;
		for(i=0;i<sizeDiff;i++){
			s6+=" ";
		}
		s6+="|";

		console.log(s1+s2+s3+s4+s5+s6);
	});

	//discretizedFlow.count();
};

/************FUNCTIONS FOR STATISTICS*************/

function hotDays(flattenedFlow){
	flattenedFlow.foreach(function(entry){
		console.log(entry.data.highTemperature);
	});
	return flattenedFlow.where((entry) => entry.data.highTemperature>=40); 
};

var weeklyStats = function(discretizedFlow, n){

    var startingDate = (n-1)*7;
	var endingDate = startingDate+7;

	console.log("week " + n + ", start: " + startingDate + ", end: " + endingDate);

	return discretizedFlow.selectFlatten().range(startingDate, endingDate);
};

var periodStats = function(discretizedFlow, startingDate, endingDate){
	return discretizedFlow.selectFlatten().range(startingDate-1, endingDate);
};

var incOrderBy = function(discretizedFlow, property){

	return discretizedFlow.selectFlatten().select(entry => entry.data).orderBy(function(a, b){
		if(a[property] < b[property])
			return -1;
		if(a[property] > b[property])
			return 1;
		return 0;
	});
};

var decOrderBy = function(discretizedFlow, property){

	return discretizedFlow.selectFlatten().select(entry => entry.data).orderBy(function(a, b){
		if(a[property] < b[property])
			return 1;
		if(a[property] > b[property])
			return -1;
		return 0;
	});
};

var incOrderByProp = function(discretizedFlow, property){
	
	var propertyFlow = discretizedFlow.selectFlatten().select(entry => entry.data).select(function(weather){ 
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

// var max = function(inputFLow, property){
// 	var propertyFlow = inputFLow.select(function(weather){
// 		return weather[property];
// 	});

// 	return propertyFlow.max();
// };

// var min = function(inputFLow, property){
// 	var propertyFlow = inputFLow.select(function(weather){
// 		return weather[property];
// 	});

// 	return propertyFlow.min();
// };

// var average = function(inputFLow, property){
// 	var propertyFlow = inputFLow.select(function(weather){
// 		return weather[property];
// 	});

// 	return propertyFlow.average();
// };







