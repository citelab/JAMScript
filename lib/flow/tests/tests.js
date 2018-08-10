/**
 * Created by Richboy on 01/07/17.
 */

var Flows = require('../flow.js')();
var Flow = Flows.Flow;


var array = [1, 2, 3];
var array2 = [4, 5, 6];
var array3 = [7, 8, 9];

var iteratorFlow = Flow.from(array).merge(array2).merge(array3);
var discretizerFlow = iteratorFlow.discretize(1, 3, false);

discretizerFlow.foreach(terminal);
//discretizerFlow.setTerminalFunction(terminal);
//iteratorFlow.startPush();


function terminal(data){
    console.log(data);
}