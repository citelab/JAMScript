/**
 * Created by Richboy on 27/06/17.
 */

"use strict";

jdata{
    int x as logger;
    f as flow with toDiscretizer of x;
}

function toDiscretizer(inputFlow){
    return inputFlow.discretize(3, 1);
}

//just print some values off the discreteFlow
var terminalFunc = discreteFlow => {
    var flow = discreteFlow.selectFlatten().select(entry => entry.data - 0);
    var avg = flow.average();
    var sum = flow.sum();

    console.log("Sum: " + sum + ", Average: " + avg);
};

f.setTerminalFunction(terminalFunc);

//poll until we have up to 3 C-Nodes running
(function poll(){
    if( x.size() < 3 ){
        console.log("waiting till we have 3 C-nodes running");
        setTimeout(poll, 2000);
    }
    else
        f.startPush();
})();
