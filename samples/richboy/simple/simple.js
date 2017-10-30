/**
 * Created by Richboy on 29/10/17.
 */


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
    return inputFlow.discretize(1, 1, false);
}

stats.setTerminalFunction(elem => {
    console.log(elem);
});

MTLWeather.addDatastream("devA");
MTLWeather.subscribe(function(key, entry, stream){
    //console.log(entry);
});
stats.startPush();

var gen;
var d = 0;

function log(index, value){
    setTimeout(function() {
        MTLWeather[index].log(value, function (result) {
            if (!result.status)
                console.log(result.error);

            gen.next();
        });
    }, 100);
}

function generateLogs() {
    //for (let i = 0; i < 100; i++) {
    while(true){
        var low = Math.random() * 32767 % 15 + 15;
        var diff = Math.random() * 32767 % 10;

        var val = {
            date: (d++) % 31 + 1,
            lowTemperature: low,
            highTemperature: low+diff,
            humidity: Math.random() * 32767 % 100 / 100,
            wind: Math.random() * 32767 % 25 + (Math.random() * 32767 % 10) / 10,
            airQuality: "good",
            UV: "strong"
        };

         log(0, val);
    }

    //setTimeout(doFlowOps, 0);
}



gen = generateLogs();
gen.next();