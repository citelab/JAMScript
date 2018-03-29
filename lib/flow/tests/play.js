/**
 * Created by Richboy on 13/07/17.
 */

const {Flow} = require('../flow.js')();

var flow = Flow.fromRange(1, 10);

console.log(flow.skip(3).limit(5).collect());
flow.collect(); //to flush all unused remaining data
console.log(flow.range(3, 8).collect());