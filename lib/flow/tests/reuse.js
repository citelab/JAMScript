/**
 * Created by Richboy on 28/06/17.
 */
var Flows = require('../flow.js');
var Flow = Flows.Flow;

var array = [1, 2, 3, 4, 5];

var flow = Flow.from(array);
var selectFlow = flow.select((input) => input + 1);
var skipFlow = selectFlow.skip(1);
var limitFlow = skipFlow.limit(3);
var whereFlow = limitFlow.where((input) => input % 2 == 0);

//console.log(flow.ended);

console.log(whereFlow._toArray());
console.log(whereFlow.ended);
console.log(whereFlow._toArray());