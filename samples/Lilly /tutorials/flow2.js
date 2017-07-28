jdata{
    struct weather{
		int highTemperature;
		int lowTemperature;
		// float humidity;
		// float wind;
		// char* airQuality;
		// char* UV;
	} MTLWeather as logger;

    f as flow with toDiscretizer of MTLWeather;
}

function toDiscretizer(inputFlow){
    return inputFlow.discretize(2, 7);
}

//just print some values off the discreteFlow
var terminalFunc = discreteFlow => {
    var flow = discreteFlow.selectFlatten().select(entry => entry.data.lowTemperature - 0);
    var avg = flow.average();
    var sum = flow.sum();

    console.log("Sum: " + sum + ", Average: " + avg);
};

f.setTerminalFunction(terminalFunc);

//poll until we have up to 3 C-Nodes running
(function poll(){
    if( MTLWeather.size() < 2 ){
        console.log("waiting till we have 2 C-nodes running");
        setTimeout(poll, 1000);
    }
    else
        f.startPush();
})();