/**
 * Created by Richboy on 03/06/17.
 */

"use strict";

var JAMLogger = require('./jamlogger.js');
var JAMManager = require('./jammanager.js');
var Flows = require('./flow.js');
var Flow = Flows.Flow;
var OutFlow = Flows.OutFlow;

var logger = new JAMLogger(JAMManager, "loggerX", "fog");

logger.addDatastream("devA");
logger.addDatastream("devB");
logger.addDatastream("devC");
logger.addDatastream("devD");

var flow = Flow.from(logger).where((obj) => +obj.data % 2 == 0);    //filter for even numbers
new OutFlow("sensor", flow).start();