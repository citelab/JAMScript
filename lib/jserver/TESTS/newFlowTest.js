/**
 * Created by Richboy on 07/06/17.
 */

var Flow = require('./flow.js').Flow;

//an example of selectExpand: prints ["my","name","is","richboy"]
console.log(Flow.from("my name is richboy").selectExpand((input) => input.split(" ")).collect(Flow.toArray()));

//an example of selectFlatten: prints [1,2,3,4,5,6,7,8,9]
console.log(Flow.from([[1,2,3],[4,5,6],[7,8,9]]).selectFlatten().collect(Flow.toArray()));