/**
 * Created by Richboy on 03/06/17.
 */

"use strict";

var JAMManager = require('./jammanager.js');
var Flows = require('./flow.js');
var Flow = Flows.Flow;
var InFlow = Flows.InFlow;

var inflow = new InFlow("app1", "sensor");

var flow = inflow.select((input) => input.data).where((input) => +input <= 200);  //select only the data/number and the filter for only numbers up to 200
flow.setTerminalFunction(process);

function process(data){
    console.log(data);
}