
jdata{
    struct temp{
        char* from;
        int value;
    } temperature as logger;

    stats as flow with statsFunc of temperature;
}

var level = 1;

function statsFunc(inputFlow){
    return inputFlow.discretize(1, 20);
}

stats.setTerminalFunction(df => {
    df.shouldCache = false;

    //find out how many are from CNode and how many are from the JNode
    var flow = df.selectFlatten().select("data");

    console.log("--- Level " + level++ + " ---");
    var cCount = flow.where(data => data.from === "cnode").count();
    var jCount = flow.where(data => data.from === "jnode").count();
    var cAvg = flow.where(data => data.from === "cnode").select(data => data.value).average();
    var jAvg = flow.where(data => data.from === "jnode").select(data => data.value).average();

    console.log("The number of elements from the CNode is " + cCount + ", with an average of " + cAvg);
    console.log("The number of elements from the JNode is " + jCount + ", with an average of " + jAvg);
    console.log();
});

(function poll(){
    if( temperature.size() < 1 ){
        console.log("waiting for a device");
        setTimeout(poll, 2000);
    }
    else
        stats.startPush();
})();



//********************//
//*** SELF LOGGING ***//
//********************//
var gen;
var d = 0;

function log(index, value){
    setTimeout(function() {
        temperature[index].log(value, function (result) {
            if (!result.status)
                console.log(result.error);

            gen.next();
        });
    }, 1000);
}

function* generateLogs() {
    while(true){
        var val = {
            from: "jnode",
            value: parseInt(Math.random() * 32767 % 15 + 15)
        };

        yield log(0, val);
    }
}


(function poll1(){
    if( temperature.size() < 1 ){
        setTimeout(poll1, 2000);
    }
    else{
        gen = generateLogs();
        gen.next();
    }
})();