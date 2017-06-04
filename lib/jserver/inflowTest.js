/**
 * Created by Richboy on 03/06/17.
 */

"use strict";

var JAMManager = require('./jammanager.js');
var Flows = require('./flow.js');
var Flow = Flows.Flow;
var InFlow = Flows.InFlow;

new InFlow(JAMManager.app, "sensor", process);

function process(data){
    console.log(data);
}