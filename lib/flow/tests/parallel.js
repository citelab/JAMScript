/**
 * Created by Richboy on 04/07/17.
 */

"use strict";

var Flows = require('../flow.js');
var Flow = Flows.Flow;
var PFlow = Flows.PFlow;
var JSONfn = require('json-fn');
PFlow.useCores(require('os').cpus().length);    //set number of cores to use


//var pFlow = PFlow.from([1,2,3,4,5]);
//console.log(pFlow.isMaster);

function start(){
    if( !PFlow.isReady() ) {
        setTimeout(start, 500);
    }
    else{
        PFlow.from([1,2,3,4,5]).count(value => console.log("Count is: " + value))
    }
}

start();