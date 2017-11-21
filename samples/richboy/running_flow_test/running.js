
jdata{
    int temp as logger;
    struct pack{
        char* name;    //custom find the longest name
        int age;
    } pack as logger;
}

var tempFlow, packFlow;
var started = false;

/**
 *
 *  runningReduce is a Flow that keeps track of interested properties/aggregations. It works as an open pipe, meaning
 *  it can be connected to any flow and does not modify the data passing through in any way.
 *
 *  The following can be determined from an object of RunningReduceFlow :
 *  getFirst(): returns the first item that past through
 *  getLast(): returns the last item so far
 *  getSum(): returns the total sum of items so far
 *  getCount(): returns the total number of items that has passed through so far
 *  getAverage(): returns the running average (dependent on 'sum' being specified as an interest in the object argument)
 *  getMin(): returns the minimum value seen so far
 *  getMax(): returns the running maximum
 *  getCustomResult(): this returns the value from a custom reduce function implementation
 *
 *  - runningReduce takes in a JS object as argument with possible options as: min, max, sum, and custom
 *  - min, max and sum can either be null (meaning that the input values to the flow should be treated as numbers),
 *    string (a reference to the property that should be treated as a number), or a function (that takes the input that
 *    passes through the flow and returns the numerical value)
 *  - custom is always a function that takes the current custom value and the input value to the flow as inputs to the
 *    function and returns the new value. The very first custom value will always be null. The function has the
 *    following structure: function(currentValue, inputValue){ return ... }
 *
 */

function tempFlowFunc(inputFlow){
    // All interested aggregation must be specified except for average which relies on sum
    return inputFlow.select("data").runningReduce({min: null, max: null, sum: null});
}

function packFlowFunc(inputFlow){
    return inputFlow.select("data").runningReduce({min: "age", max: "age", sum: "age", custom: (currentValue, newValue) => {
        //console.log("newValue is ", newValue);
        if( currentValue === null ) //this will always be the case for the very first execution
            return newValue.name;
        return currentValue.length > newValue.name.length ? currentValue : newValue.name;
    }});
}

(function poll(){
    if( temp.size() < 1 || pack.size() < 1 ){
        console.log("waiting for a C-node");
        setTimeout(poll, 2000);
    }
    else {
        tempFlow = tempFlowFunc(Flow.from(temp[0]));
        packFlow = packFlowFunc(Flow.from(pack[0]));
        tempFlow.startPush();
        packFlow.startPush();
        started = true;
    }
})();

//get statistics every 10 seconds
setInterval(function(){
    if( !started )
        return;

    console.log("\n-- Temperature Data --");
    console.log("Minimum is ", tempFlow.getMin());
    console.log("Maximum is ", tempFlow.getMax());
    console.log("Sum is ", tempFlow.getSum());
    console.log("Last is ", tempFlow.getLast());
    console.log("Average is ", tempFlow.getAverage());


    console.log("\n-- Custom Data --");
    console.log("Minimum is ", packFlow.getMin());
    console.log("Maximum is ", packFlow.getMax());
    console.log("Sum is ", packFlow.getSum());
    console.log("Last is ", packFlow.getLast());
    console.log("Average is ", packFlow.getAverage());
    console.log("Custom Result is ", packFlow.getCustomResult());

    console.log();
}, 1e4);