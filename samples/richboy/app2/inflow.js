/**
 * Created by Richboy on 21/06/17.
 */
"use strict";

jdata{
    r as inflow of app://app1.p;
}

var flow = r.select(function(input){ return input.data; }).where(function(input){return +input <= 200;});  //select only the data/number and the filter for only numbers up to 200
flow.setTerminalFunction(process);

function process(data){
    console.log(data);
}