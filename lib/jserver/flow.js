/**
 * Created by Richboy on 02/06/17.
 */
/**
 * Created by Richboy on 30/05/17.
 */

"use strict";

var Manager = require('./jammanager.js');

(function(){
    class Flow{
        constructor() {
            this.prev = null;    //The previous operation for this Flow
            this.next = null;    //The next operation for this Flow
            this.pipeFunc = (output) => output;    //The Pipe function to execute for this Flow
            this.rootFlow = null;   //The First Flow...to be used for push operations (Can be used for InFlow/OutFlow)
            this.terminalFunc = (output) => {}; //This is the Flow terminal function for a push operation. It is mostly for the last created Flow in the Flow chain.
        }

        /**
         * This method uses the flow linking construct to trigger data processing
         * @returns {*}
         */
        process(){
            return this.prev.process();
        }

        /**
         * This method is used for the Pipeline operation.
         * It receives data from the previous Flow and channels the processed data to the next Flow (if any).
         * @param input the input from the previous Flow
         * @returns {*}
         */
        pipe(input){
            var outcome = this.pipeFunc(input);

            if( this.next !== null )
                return this.next.pipe(outcome);
            return outcome;
        }


        pull(){
            this.prev.pull();
        }


        push(input){
            var outcome = this.pipeFunc(input);

            if( this.next !== null )
                this.next.push(outcome);
        }

        /**
         * This method is used to set a custom terminal function for the push on the last created Flow in the Flow chain
         * @param func the custom function to call with the last output
         */
        setTerminalFunction(func){
            if( Util.isFunction(func) )
                this.terminalFunc = func;
        }


        /**
         * This method create a Flow from several data types. Supported data types are: Array, Flow, Map, Set, Object, FileSystem, JAMLogger
         * @param data the data from which a Flow object would be created
         */
        static from(data){
            return FlowFactory.getFlow(data);
        }



        //*******************
        //   FLOW METHODS
        //*******************

        /**
         * This method restricts data operation to a certain number, starting from the first item it can see.
         * @param num the total number of items required.
         */
        limit(num){
            var flow = new RangeMethodFlow(0, num);

            setRefs(this, flow);

            return flow;
        }

        /**
         * The number of elements to skip in the data stream
         * @param num the number of elements
         */
        skip(num){
            var flow = new RangeMethodFlow(num, Number.MAX_VALUE);

            setRefs(this, flow);

            return flow;
        }

        /**
         * This create a data window to operate on
         * @param startIndex the starting point/index in the data stream...closely related to the amount of elements to skip
         * @param endIndex the ending point/index in the data stream.
         */
        range(startIndex, endIndex){
            var flow = new RangeMethodFlow(startIndex, endIndex);

            setRefs(this, flow);

            return flow;
        }

        /**
         * This maps one or more parts of a data...as with Map-Reduce
         * @param func the mapping function
         */
        select(func){
            var flow = new Flow(func);
            flow.pipeFunc = func;

            setRefs(this, flow);

            return flow;
        }

        /**
         * This maps data from one input to many outputs using the input function to generate the collection
         * @param func the function to generate a collection (multiple outputs) from an input
         */
        selectExpand(func){
            var flow = new SelectExpandFlattenMethodFlow(func);

            setRefs(this, flow);

            return flow;
        }

        /**
         * This maps data from one input to many outputs. The input is already a form of collection/iterable supported
         * by Flow.from(...)
         * @returns {*}
         */
        selectFlatten(){
            return this.selectExpand((input) => input);
        }

        /**
         * This does data filtering
         * @param func the filtering function. The function is expected to return a boolean
         */
        where(func){
            var flow = new WhereMethodFlow(func);

            setRefs(this, flow);

            return flow;
        }

        orderBy(){

        }

        groupBy(){

        }

        //May not be necessary
        join(){

        }




        //*******************
        //   FLOW ACTIONS
        //*******************

        /**
         * Counts the items visible at the last Flow
         * @returns {number} the total number of items found
         */
        count(){
            var total = 0;
            var temp;

            while( (temp = this.process()) != null )
                total++;

            return total;
        }

        //Dummy function to be used by collect
        static toArray(){
            return "toArray";
        }

        //Dummy function to be used by collect
        static toSet(){
            return "toSet"
        }

        _toSet(){
            var set = new Set();

            var data;

            while( (data = this.process()) != null )
                set.add(data);

            return set;
        }

        _toArray(){
            var array = [];
            var data;

            while( (data = this.process()) != null )
                array.push(data);

            return array;
        }

        /**
         * This method allows data collation to either an Array or a Set...a Map will be possible later
         * @param func either Flow.toArray or Flow.toSet
         * @returns {*} the data in the required format
         */
        collect(func){
            if( Util.isFunction(func) ) {
                if( func == Flow.toArray )
                    return this._toArray();
                if( func == Flow.toSet )
                    return this._toSet();
            }
            else if( Util.isString(func) ){
                if( func.toLowerCase() == "toarray" )
                    return this._toArray();
                if( func.toLowerCase() == "toset" )
                    return this._toSet();
            }
            //use toArray as Default
            return this._toArray();
        }

        /**
         * This allows a custom operation on the data elements seen at the last Flow
         * @param func the custom function to operate on each element of the data collection
         */
        foreach(func){
            var data;

            while( (data = this.process()) != null )
                func(data);
        }

        anyMatch(func){
            var data;

            while( (data = this.process()) != null ){
                if( func(data) )
                    return true;
            }

            return false;
        }

        allMatch(func){
            var data;

            while( (data = this.process()) != null ){
                if( !func(data) )
                    return false;
            }

            return true;
        }

        noneMatch(func){
            return !this.anyMatch(func);
        }

        findFirst(){
            return this.process();
        }

        findAny(){
            return this.findFirst();
        }

        findLast(){
            var data, found = null;

            while( (data = this.process()) != null )
                found = data;

            return found;
        }

        average(){
            var data, sum = 0, count = 0;

            while( (data = this.process()) != null ){
                sum += data;
                count++;
            }

            return sum / count;
        }

        reduce(init, func){
            var data, temp = init;

            while( (data = this.process()) != null )
                temp = func(temp, data);

            return temp;
        }
    }

    /**
     * This function is used to set the linked references for Flows (like LinkedLists)
     * @param primary the current Flow
     * @param secondary the newly created Flow based on the primary
     */
    function setRefs(primary, secondary){
        secondary.prev = primary;
        primary.next = secondary;

        secondary.rootFlow = primary.rootFlow;
    }


    /**
     * This is the first Flow that will be created from the data types. The major difference between this class
     * and the Flow class is that the process method in this class does same thing as the pipe method in the Flow class
     */
    class IteratorFlow extends Flow{
        /**
         * @param iterator a JS Iterator object (could be a generator)
         */
        constructor(iterator){
            super();
            this.iterators = [];
            this.iterators.push(iterator);
            this.rootFlow = this;
            this.pos = 0;

            this.isDiscretized = false;     //If this Flow is discretized
            this.discreteStreamLength = 1;  //The number of streams to iterate through for the discretization
            this.isDataEndObject = {isDataEnd: (data) => false};   //A object that implements the isDataEnd The function to check if we have gotten to the end of a discrete stream
        }

        /**
         * The process method will act like the pipe method in the default Flow class (but without an input)
         */
        process(){
            //##go through the iterators one after the other##
            if( this.pos >= this.iterators.length )
                return null;

            //get the data from the current iterator
            var obj = this.iterators[this.pos].next();

            //check for the next iterator that has data
            while( obj.done && this.pos < this.iterators.length ){
                this.pos++;
                if( this.pos >= this.iterators.length )
                    break;

                obj = this.iterators[this.pos].next();
            }

            if( obj.done )
                return null;

            if( this.next !== null )
                return this.next.pipe(obj.value);
            return obj.value;
        }

        /**
         * This methods merges another data input on the current stream. It is only available to IteratorFlow
         * @param data the object to create an IteratorFlow from (more like the output from 'Flow.from')
         */
        merge(data){
            var iterators = FlowFactory.getFlow(data).iterators;//we are only interested in the iterators in this new Flow
            for(let iterator of iterators)
                this.iterators.push(iterator);

            return this;
        }

        /**
         * This method is used by OutFlow to trigger the start of push
         */
        pull(){//This may work best for OutFlow from filesystem...since it is static
            while(true) {
                if (this.pos >= this.iterators.length)
                    break;

                //get the data from the current iterator
                var obj = this.iterators[this.pos].next();

                //check for the next iterator that has data
                while (obj.done && this.pos < this.iterators.length) {
                    this.pos++;
                    if (this.pos >= this.iterators.length)
                        break;

                    obj = this.iterators[this.pos].next();
                }

                if (obj.done)
                    break;

                push(obj.value);
            }
        }

        /**
         * Register to listen for data changes in loggers and streams and push elements through the Flow chain
         * This method should be called when the push operation is required
         */
        listen(){
            var self = this;

            for( let iterator of this.iterators ){
                if( iterator.logger ){//if this iterator was a datasource/logger
                    var obj;

                    while( true ){
                        obj = iterator.next();  //obj.value is a datastream
                        if( obj.done )
                            break;

                        subscribeToStream(obj.value, self);
                    }
                }
                else if( iterator.stream )//if this iterator was a datastream
                    subscribeToStream(iterator.stream, self);
            }
        }

        push(input){
            this.next !== null ? this.next.push(input) : this.terminalFunc(input);
        }

        /**
         * This method makes an IteratorFlow discretizable. It is only available to an IteratorFlow (for now).
         * @param streams The number of streams to look at in the window.
         *      'streams' value of 1 means that we focus on on stream for the window size and move to the next stream.
         *      'streams' value greater than 1 means that we should do a round-robin based on the specified number
         *          and then move to the next stream(s) and do the same, operating on the data based on the specified length
         * @param length The window length. The length of data to be treated as one (a block).
         *      I'm thinking we could make length to be a function that determines when we have gotten to the last item.
         *      This could be used for custom time-based discretization. So data could be split based on time.
         */
        discretize(streams, length){
            this.discreteStreamLength = Util.isNumber(streams) ? streams : (Util.isArray(streams) ? streams.length : 1);

            if( Util.isNumber(length) ){
                this.isDataEndObject = (function(l){
                    var length = l;
                    var pos = 0;

                    return {
                        isDataEnd: function(data){
                            try {
                                if (pos < length)
                                    return false;
                                else{
                                    pos = -1;
                                    return true;
                                }
                            }
                            finally{
                                pos++;
                            }
                        }
                    };
                })( Math.ceil(length) );
            }
            else if( Util.isFunction(length) ){
                this.isDataEndObject = (function(length){
                    return {
                        isDataEnd: length
                    };
                })(length);
            }
            else if( length.isDataEnd && Util.isFunction(length.isDataEnd) )
                this.isDataEndObject = length;
            else
                throw "length can be either a Number, a function or an object with an 'isDataEnd' function";

            return this;
        }
    }

    /**
     * This method subscribes a Flow (IteratorFlow) to a datastream to listen for data changes
     * This method is placed outside the class to prevent external access
     * @param stream the datastream to subscribe to
     * @param flow the IteratorFlow object which will initiate the push
     */
    function subscribeToStream(stream, flow){
        stream.subscribe(function(key, entry){
            var obj = {
                key: Manager.buildKeyObject(key),
                data: entry.log,
                timestamp: entry.time_stamp
            };
            flow.push(obj);
        });
    }


    /**
     * This class is used to flatten
     */
    class SelectExpandFlattenMethodFlow extends Flow{
        /**
         *
         * @param func a function that uses the input to generate a data collection that is supported by Flow.from(...)
         */
        constructor(func){
            super();
            this.pipeFunc = func;
            this.iteratorFlow = null;   //This is just used as an iterator for the the generated collection.
        }

        process(){
            if( this.iteratorFlow == null )
                return this.prev.process();

            var obj = this.iteratorFlow.process();
            if( obj == null ){
                this.iteratorFlow = null;
                return this.prev.process();
            }

            if( this.next !== null )
                this.next.pipe(obj);

            return obj;
        }

        pipe(input){
            this.iteratorFlow = Flow.from(this.pipeFunc(input));

            return this.process();
        }

        push(input){
            this.iteratorFlow = Flow.from(this.pipeFunc(input));

            var output;
            while( (output = this.process()) != null ){
                this.next !== null ? this.next.push(output) : this.terminalFunc(output);
            }
        }
    }


    /**
     * This class is used for the Flow methods: skip, limit & range.
     * It is used to limit/restrict the data that would be processed...more like creating a data window.
     */
    class RangeMethodFlow extends Flow{
        /**
         *
         * @param startIndex the index to start from (inclusive)
         * @param endIndex the index to end (exclusive)
         */
        constructor(startIndex, endIndex){
            super();
            this.start = startIndex;
            this.end = endIndex;
            this.position = 0;
        }

        pipe(input){
            if( this.position < this.end ){
                this.position++;

                if( this.position <= this.start )
                    return this.prev.process();

                if( this.next !== null )
                    return this.next.pipe(input);
                else
                    return input;
            }
            else
                return null;
        }

        push(input){
            if( this.position < this.end ){
                this.position++;

                if( this.position <= this.start ) {
                    return;
                }

                this.next !== null ? this.next.push(input) : this.terminalFunc(input);
            }
        }
    }

    /**
     * The where method (filter) class Flow definition
     */
    class WhereMethodFlow extends Flow{
        constructor(func){
            super();
            this.pipeFunc = func;
        }

        pipe(input){
            var outcome = this.pipeFunc(input);

            if( !outcome )
                return this.prev.process();

            if( this.next !== null )
                return this.next.pipe(input);
            return input;
        }

        push(input){
            var outcome = this.pipeFunc(input);

            if( !outcome ) {
                return;
            }

            this.next !== null ? this.next.push(input) : this.terminalFunc(input);
        }
    }



    /**
     *
     */
    class InFlow extends Flow{
        /**
         *
         * @param app the app which this InFlow needs to connect to in order to receive data
         * @param varName the OutFlow variable name to connect to in app
         */
        constructor(app, varName){
            super();

            //build key object
            this.key = {
                app: app,
                flow: varName
            };

            this.lastValueIndex = 0;

            //subscribe for changes
            Manager.subscribe(this.key, this);
        }

        /**
         * This method received notification from the Manager subscription
         * @param keyObject the object representation of the key that had a generated event
         */
        notify(keyObject){
            var key = Manager.buildKey(keyObject);
            var self = this;

            //retrieve data from redis for the key...from the last known state
            Manager.redis.rawCall(['ZRANGE', key, this.lastValueIndex + 1, -1], function(e, response){
                if( e )
                    throw e;

                var parts, pack;
                for (var i = 0; i < response.length; i++) {
                    self.lastValueIndex++;

                    parts = response[i].split(Manager.delimiter);
                    //pack = {
                    //    key: keyObject,
                    //    data: parts[0],
                    //    timestamp: parts[3]
                    //};

                    self.push(JSON.parse(parts[0]));    //convert data back to JSON and push
                }
            });
        }

        push(input){
            this.next === null ? this.terminalFunc(input) : this.next.push(input);
        }
    }


    /**
     *
     */
    class OutFlow extends Flow{
        /**
         *
         * @param varName This is the variable name from the JData definition for this OutFlow
         * @param source This is the Flow that this OutFlow is based on. The Flow can wrap a FileSystem
         */
        constructor(varName, source){
            super();

            if( !(source instanceof Flow) )//check if source is a Flow
                throw "Source is NOT a Flow";

            //build key object
            this.key = {
                app: Manager.app,
                flow: varName
            };

            this.source = source;
            setRefs(source, this);  //Create a link from the source flow to this flow so that we receive push data
            this.pipeFunc = (input) => input;   //Create a default function to regularize the Flow design
        }

        triggerPush(){
            this.rootFlow.listen();
        }

        push(input){
            Manager.simpleLog(this.key, input, (response) => {
                if( !response.status )
                    console.log(response.error);
            });
        }
    }


    /**
     * This class employs the Factory design pattern to create the initial/first Flow from several input types
     */
    class FlowFactory{

        static getFlow(data){
            //find the type of data passed
            if( Util.isArray(data) && !Util.isString(data) )
                return FlowFactory.createFlowFromArray(data);

            if( Util.isMap(data) )
                return FlowFactory.createFlowFromMap(data);

            if( Util.isSet(data) )
                return FlowFactory.createFlowFromSet(data);

            if( Util.isLogger(data) )
                return FlowFactory.createFlowFromJAMLogger(data);

            if( Util.isDataStream(data) )
                return FlowFactory.createFlowFromJAMDataStream(data);

            if( Util.isString(data) && data.toLowerCase().startsWith("fs://") )
                return FlowFactory.createFlowFromFileSystem(data);

            if( Util.isIterable(data) && !Util.isString(data) )
                return FlowFactory.createFlowFromIterable(data);

            if( Util.isObject(data) && !Util.isString(data) )
                return FlowFactory.createFlowFromObject(data);

            return FlowFactory.createFlowFromValue(data);
        }

        /**
         *
         * @param array Javascript Array
         */
        static createFlowFromArray(array){
            return new IteratorFlow((function(){
                var index = 0;

                return {
                    next: function(){
                        return index < array.length ? {value: array[index++], done: false} : {done: true};
                    }
                };
            })());
        }

        /**
         *
         * @param map Javascript Map object
         */
        static createFlowFromMap(map){
            return new IteratorFlow((function(){
                var entries = map.entries();

                return {
                    next: function(){
                        var entry = entries.next();
                        if( entry.done )
                            return entry;
                        else
                            return {value: {key: entry.value[0], value: entry.value[1]}, done: false};
                    }
                };
            })());
        }

        /**
         *
         * @param set Javascript Set object
         * @returns {*}
         */
        static createFlowFromSet(set){
            return FlowFactory.createFlowFromArray(Array.from(set));
        }

        /**
         * Create a Flow from any object that implements the Javascript Iterable framework
         * @param iterable the iterable which could be navigated via a next method
         */
        static createFlowFromIterable(iterable){
            return new IteratorFlow(iterable);
        }


        /**
         * Create a Flow from a Javascript Object, iterating through the properties and creating a property-value pair
         * @param object the JS object
         */
        static createFlowFromObject(object){
            return new IteratorFlow((function(){
                var keys = Object.keys(object);
                var pos = 0;
                var length = keys.length;

                return {
                    next: function(){
                        try {
                            return pos < length ? {value: {key: keys[pos], value: object[keys[pos]]}, done: false} : {done: true};
                        }
                        finally{
                            pos++;
                        }
                    }
                };
            })());
        }

        /**
         *
         * @param path File System path
         */
        static createFlowFromFileSystem(path){
            return new IteratorFlow((function(){
                path = path.substring("fs://".length);

                var lineByLine = require('./inc/readlines.js');
                var liner = new lineByLine(path);

                return {
                    next: function(){
                        var line = liner.next();

                        if( line )
                            return {value: line.toString("utf8"), done: false};

                        return {done: true};
                    }
                };
            })());
        }

        /**
         * Create a Flow from a JAMDatasource derivative
         * @param logger the object that implements JAMLogger or JAMDatasource
         */
        static createFlowFromJAMLogger(logger){
            return new IteratorFlow((function(){
                var pos = 0;
                var streams = logger;
                var length = streams.size();

                return {
                    next: function(){
                        return pos < length ? {value: streams[pos++], done: false} : {done: true};
                    },
                    logger: streams
                };
            })());
        }

        /**
         * Create a Flow from a JAMDatastream derivative
         * @param dataStream the object that implements JAMDatastream
         */
        static createFlowFromJAMDataStream(dataStream){
            //TODO we could use a generator to produce the data (if data is on Redis). We need to make the JAMDatastream to implement JS Iterator
            return new IteratorFlow((function(){
                var pos = 0;
                var stream = dataStream;

                return {
                    next: function(){
                        return pos < stream.size() ? {value: stream.get_value_at(pos++), done: false} : {done: true};
                    },
                    stream: stream
                };
            })());
        }

        /**
         * As opposed to throwing an exception, create a Flow with the value as the only value
         * @param value
         */
        static createFlowFromValue(value){
            return new IteratorFlow((function(){
                var used = false;

                return {
                    next: function(){
                        try {
                            return used ? {done: true} : {value: value, done: false};
                        }
                        finally{
                            used = true;
                        }
                    }
                };
            })());
        }
    }

    var Util = {
        isFunction: function(obj) {
            return typeof obj === 'function' || false;
        },
        isArray: function (obj) {
            return typeof obj.length === 'number' && obj.length >= 0;
        },
        isSet: function(obj) {
            return obj instanceof Set && Util.isFunction(obj.values);
        },
        isMap: function(obj) {
            return obj instanceof Map && Util.isFunction(obj.values);
        },
        isObject: function(obj) {
            return Boolean(obj) && typeof obj === 'object';
        },
        isString: function(obj) {
            return Object.prototype.toString.call(obj) === '[object String]';
        },
        isLogger: function(obj){
            return obj.constructor && obj.constructor.name && Util.isIn(obj.constructor.name, ['JAMDatasource', 'JAMLogger']);
        },
        isDataStream: function(obj){
            return obj.constructor && obj.constructor.name && Util.isIn(obj.constructor.name, ['JAMDatastream']);
        },
        isIn: function(needle, haystack){
            for(let i = 0; i < haystack.length; i++){
                if( needle === haystack[i] )
                    return true;
            }
            return false;
        },
        isNumber: function(obj) {
            return Object.prototype.toString.call(obj) === '[object Number]';
        },
        isIterable: function(obj){
            return Util.isFunction(obj[Symbol.iterator]) || (obj.next && Util.isFunction(obj.next));
        }
    };


    module.exports = {
        Flow: Flow,
        InFlow: InFlow,
        OutFlow: OutFlow
    };
})();