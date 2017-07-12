/**
 * Created by Richboy on 27/06/17.
 */

"use strict";

jdata{
    int x as logger;
    f as flow with toDiscretizer of x;
}

//function waitForData(){
//    if( x.size() == 0 )
//        setTimeout(waitForData, 1000);
//    else
//        setInterval(readData, 1000);
//}
//
//function readData(){
//    for(var i = 0; i < x.size(); i++){
//        console.log(x[i].dev_id + ": " + x[i].lastValue());
//    }
//}
//
//waitForData();

function toDiscretizer(inputFlow){
    return inputFlow.discretize(x.size(), 1);
}

//just print some values off the discreteFlow
f.setTerminalFunction(discreteFlow => {
    let avg = discreteFlow.average();
    let sum = discreteFlow.sum();

    console.log("Sum: " + sum + ", Average: " + avg);
});

//poll until we have up to 3 C-Nodes running
(function poll(){
    //poll to start
    if( x.size() < 3 ){
        console.log("waiting till we have 3 C-nodes running");
        setTimeout(poll, 1000);
    }
    else
        f.startPush();
})();