/**
 * Created by Richboy.
 */

var DEVICE_COUNT = 2;	//the number of devices required for this example to execute

jdata{
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
    return inputFlow.discretize(DEVICE_COUNT, 31);
}

stats.setTerminalFunction(function(f){
    console.log("**********************************Monthly Statistics**********************************");
    //f.shouldCache = false; // this line will make week1.count() be 0

    var temp = [];

    f.selectFlatten().collect().forEach(function(obj, index){
        obj.device = MTLWeather[index % DEVICE_COUNT];
        obj.deviceIndex = index % DEVICE_COUNT;
        temp.push(obj);
    });

    f = Flow.from(temp);

    var month = f;
    console.log("Monthly hot days:", hotDays(month).count());
    month.count();
    prettyPrint(month);

    console.log("**********************************Weekly Statistics***********************************");
    console.log("***************************************Week 1*****************************************");

    var week1 = weeklyStats(f, 1);
    f.count();

    console.log("week1 hot days:", hotDays(week1).count());
    week1.count();
    prettyPrint(week1);


    console.log("***************************************Week 2*****************************************");

    var week2 = weeklyStats(f, 2);
    f.count();

    console.log("week2 hot days:", hotDays(week2).count());
    week2.count();
    prettyPrint(week2);


    console.log("***************************************Week 3*****************************************");

    var week3 = weeklyStats(f, 3);
    f.count();

    console.log("week3 hot days:", hotDays(week3).count());
    week3.count();
    prettyPrint(week3);


    console.log("***************************************Week 4*****************************************");

    var week4 = weeklyStats(f, 4);
    f.count();

    console.log("week4 hot days:", hotDays(week4).count());
    week4.count();
    prettyPrint(week4);


    console.log("***************************************periodStats: Date 20-25*****************************************");

    var period = periodStats(f, 19, 25);
    f.count();

    console.log("Period hot days:", hotDays(period).count());
    period.count();
    prettyPrint(period);

    console.log("***************************************highTemperature: low to high*****************************************");

    f.count();
    var byHighTemp = incOrderBy(f, "highTemperature");
    prettyPrint(byHighTemp);

    console.log("***************************************humidity: high to low*****************************************");

    f.count();
    var byHumidity = decOrderBy(f, "humidity");
    prettyPrint(byHumidity);

    console.log("***************************************Collect lowTemperature: low to high*****************************************");

    f.count();
    var byLowTemp = incOrderByProp(f, "lowTemperature");
    console.log(byLowTemp.collect());

    console.log("***************************************Week 1 temperature in Fahrenheit*****************************************");

    week1.count();
    var week1Fahrenheit = toFahrenheit(week1);
    prettyPrint(week1Fahrenheit);
});

(function poll(){
    if( MTLWeather.size() < DEVICE_COUNT ){
        console.log("waiting for "+ DEVICE_COUNT +" connected streams");
        setTimeout(poll, 2000);
    }
    else
        stats.startPush();
})();

// @ args: a dicretized flow that has been flattened
function prettyPrint(flattenedFlow){

    var size1 = String("|  highTemperature  ").length,
        size2 = String("|  lowTemperature  ").length,
        size3 = String("|  humidity  ").length,
        size4 = String("|  wind  ").length,
        size5 = String("|  airQuality  ").length,
        size6 = String("|  UV  ").length,
        size7 = String("|  Date  |").length,
        size8 = String("|  Device  ").length;

    var header = "|  Device  |  Date  |  highTemperature  |  lowTemperature  |  humidity  |  wind  |  airQuality  |  UV  |";
    console.log(header);

    flattenedFlow.foreach(function(obj){
        var weather;
        if(obj.data != undefined && obj.data != null)
            weather = obj.data;
        var sizeDiff;

        var s8 = "|  "+String(obj.deviceIndex + 1);
        sizeDiff = size8-s8.length+1;
        for(var i=1;i<sizeDiff;i++){
            s8+=" ";
        }

        var s7 = "|  "+String(weather.date);
        sizeDiff = size7-s7.length+1;
        for(var i=2;i<sizeDiff;i++){
            s7+=" ";
        }

        var s1 = "|  "+String(weather.highTemperature);
        sizeDiff = size1-s1.length+1;
        for(var i=1;i<sizeDiff;i++){
            s1+=" ";
        }


        var s2 = "|  "+String(weather.lowTemperature);
        sizeDiff = size2-s2.length+1;
        for(i=1;i<sizeDiff;i++){
            s2+=" ";
        }

        var s3 = "|  "+String(weather.humidity);
        sizeDiff = size3-s3.length+1;
        for(i=1;i<sizeDiff;i++){
            s3+=" ";
        }

        var s4 = "|  "+String(weather.wind);
        sizeDiff = size4-s4.length+1;
        for(i=1;i<sizeDiff;i++){
            s4+=" ";
        }

        var s5 = "|  "+String(weather.airQuality);
        sizeDiff = size5-s5.length+1;
        for(i=1;i<sizeDiff;i++){
            s5+=" ";
        }

        var s6 = "|"+String(weather.UV);
        sizeDiff = size6-s6.length+1;
        for(i=1;i<sizeDiff;i++){
            s6+=" ";
        }
        s6+="|";

        console.log(s8+s7+s1+s2+s3+s4+s5+s6);
    });
};

/************FUNCTIONS FOR STATISTICS*************/

// @ args: a discretized flow that has been flattened
// @ returns: a finite flattened flow containing data in flattenedFlow whose [hightTemperature] attribute >= 35
function hotDays(flattenedFlow){
    return flattenedFlow.where((entry) => entry.data.highTemperature>=35);
};

// @ args:
// discretizedFlow: a discretized flow that has NOT been flattened
// n: an integer indicates the index of the intended week
// @ returns: a finite flattened flow containing data from the n-th week in discretizedFlow
var weeklyStats = function(flow, n){

    var startingDate = (n-1)*(7 * DEVICE_COUNT);
    var endingDate = startingDate+(7 * DEVICE_COUNT);

    return flow.range(startingDate, endingDate);
};

// @ args:
// discretizedFlow: a discretized flow that has NOT been flattened
// startingDate: the starting date of the intended period (inclusive)
// endingDate: the ending date of the intended period (exclusive)
// @ returns: a finite flattened flow containing data from the period [startingDate, endingDate) in discretizedFlow
var periodStats = function(discretizedFlow, startingDate, endingDate){
    return discretizedFlow.range(startingDate, endingDate);
};

// @ args:
// flattendFlow: a discretized flow that has been flattened
// property: a string indicating the property to order by
// @ returns: a finite flattened flow containing all data from flattenedFlow incrementally ordered by property
var incOrderBy = function(discretizedFlow, property){

    return discretizedFlow.orderBy(function(a, b){
        if(a.data[property] < b.data[property])
            return -1;
        if(a.data[property] > b.data[property])
            return 1;
        return 0;
    });
};

// @ args:
// flattendFlow: a discretized flow that has been flattened
// property: a string indicating the property to order by
// @ returns: a finite flattened flow containing all data from flattenedFlow decrementally ordered by property
var decOrderBy = function(discretizedFlow, property){

    return discretizedFlow.orderBy(function(a, b){
        if(a.data[property] < b.data[property])
            return 1;
        if(a.data[property] > b.data[property])
            return -1;
        return 0;
    });
};

// @ args:
// flattendFlow: a discretized flow that has been flattened
// property: a string indicating the property to order by
// @ returns: a finite flattened flow containing all data[property] from flattenedFlow that is incrementally ordered
var incOrderByProp = function(discretizedFlow, property){

    var propertyFlow = discretizedFlow.select(entry => entry.data).select(function(weather){
        return weather[property];
    });

    return propertyFlow.orderBy();
};

// @ args:
// flattendFlow: a discretized flow that has been flattened
// property: a string indicating the property to order by
// @ returns: a finite flattened flow containing all data[property] from flattenedFlow that is decrementally ordered
var decOrderByProp = function(flattenedFlow, property){

    var propertyFlow = flattenedFlow.select(entry => entry.data).select(function(weather){
        return weather[property];
    });

    return propertyFlow.orderBy(function(a,b){
        if(a<b) return 1;
        if(a>b) return -1;
        return 0;
    });
};

// @ args: a discretized flow that has been flattened
// @ returns: a finite flattened flow containing all data from flattenedFlow with [highTemperature] and [lowTemperature] converted to Fahrenheit
var toFahrenheit = function(flattenedFlow){

    return flattenedFlow.select(function(entry){
        entry.data.highTemperature = entry.data.highTemperature*1.8 + 32;
        entry.data.lowTemperature = entry.data.lowTemperature*1.8 + 32;
        return entry;
    });
};


//********************//
//*** SELF LOGGING ***//
//********************//
var gen;
var d = 0;

function log(index, value){
    setTimeout(function() {
        MTLWeather[index].log(value, function (result) {
            if (!result.status)
                console.log(result.error);

            gen.next();
        });
    }, 30);
}

function* generateLogs() {
    //for (let i = 0; i < 100; i++) {
    while(true){
        var low = Math.random() * 32767 % 15 + 15;
        var diff = Math.random() * 32767 % 10;

        var val = {
            date: (d++) % 31 + 1,
            lowTemperature: parseInt(low),
            highTemperature: parseInt(low+diff),
            humidity: parseInt(Math.random() * 32767 % 100 / 100),
            wind: parseInt(Math.random() * 32767 % 25 + (Math.random() * 32767 % 10) / 10),
            airQuality: "good",
            UV: "strong"
        };

        yield log(1, val);
    }

    //setTimeout(doFlowOps, 0);
}


(function poll1(){
    if( MTLWeather.size() < 1 ){
        setTimeout(poll1, 2000);
    }
    else{
        MTLWeather.addDatastream("devA");
        gen = generateLogs();
        gen.next();
    }
})();