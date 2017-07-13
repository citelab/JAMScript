/**
 * Created by Richboy on 02/06/17.
 */
"use strict";

var JAMLogger = (require('jamserver')(true)).JAMLogger;
var JAMManager = (require('jamserver')(true)).JAMManager;
const {Flow} = require('../flow.js')(JAMManager);

var logger = new JAMLogger(JAMManager, "loggerX", "fog");

logger.addDatastream("devA");
logger.addDatastream("devB");
logger.addDatastream("devC");
logger.addDatastream("devD");

var iFlow = Flow.from(logger);
var f = iFlow.discretize(logger.size(), 1, false);
f.setTerminalFunction((input) => {
    console.log(input);
});

f.startPush();


function log(index, value){
    setTimeout(function() {
        logger[index].log(value, function (result) {
            if (!result.status)
                console.log(result.error);
            else
                console.log(logger[index].key + ": " + value);//console.log("Generated: " + value);

            gen.next();
        });
    }, Math.random() * 10 * 200);
}

function* generateLogs() {
    //for (let i = 0; i < 100; i++) {
    while(true){
        var rand = Math.floor(Math.random() * logger.size());
        var val = Math.floor(Math.random() * 1000);

        yield log(rand, val);
    }

    //setTimeout(doFlowOps, 0);
}

var gen = generateLogs();
gen.next();



/*
function doFlowOps(){
    var flow = Flow.from(logger[0]);
    for( let i = 1; i < logger.size(); i++ )
        flow.merge(logger[i]);

    console.log(flow.count());
}
*/