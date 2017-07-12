/**
 * Created by Richboy on 04/07/17.
 */

"use strict";

(function(){
    var Flow = require('./flow.js').Flow;
    var Farm = require('./farm.js');

    class ParallelFlow extends Flow{
        constructor(){
            super();

            this.iteratorFlow = null;   //the iterator flow generating the data
            this.isMaster = Farm.isMaster;
        }

        static from(data){
            var parallelFlow = new ParallelFlow();
            parallelFlow.iteratorFlow = Flow.from(data);
            return parallelFlow;
        }

        //static of(){
        //    var parallelFlow = new ParallelFlow();
        //
        //    var iteratorFlow;
        //
        //    if( arguments.length == 0 )
        //        iteratorFlow = FlowFactory.getFlow([]);
        //    else if( arguments.length > 1 )
        //        iteratorFlow = FlowFactory.getFlow(arguments);
        //    else if( arguments.length == 1 && Util.isNumber(arguments[0]) )
        //        iteratorFlow = FlowFactory.createFlowWithEmptyArraysFromNumber(arguments[0]);
        //    else
        //        iteratorFlow = FlowFactory.getFlow(arguments[0]);
        //
        //    parallelFlow.iteratorFlow = iteratorFlow;
        //    return parallelFlow;
        //}

        static fromRange(start, end){
            var parallelFlow = new ParallelFlow();
            parallelFlow.iteratorFlow = Flow.fromRange(start, end);
            return parallelFlow;
        }


    }

    module.exports = ParallelFlow;
})();