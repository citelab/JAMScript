/**
 * Created by Richboy on 30/05/17.
 */

"use strict";

module.exports = function(Manager){
    var Queue = require('./Queue.js');
    //var Farm = require('./farm.js');
    //var JSONfn = require('json-fn');

    var rtserver = null;    //real-time server
    var isRTServer = false;
    var io, ioPort = null;
    var runningApps = {};   //keep track of all apps that are running and their socket number as well as last updated time in format: {app, port, lastSeen}
    const PING_INTERVAL = 10000;
    var appName = Manager ? Manager.app : "testapp-" + new Date().getTime();
    var level = Manager && typeof Manager.getLevelCode === 'function' ? Manager.getLevelCode() : "device";

    init(); //initialize for the real-time flow algorithm and processes

    function init(){
        tryConnect();

        let srv = require('http').createServer();
        io = require('socket.io')(srv);
        srv.listen(0, function() {
            //console.log('Listening on port ' + srv.address().port);
            ioPort = srv.address().port;

            runningApps[appName] = {app: appName, port: ioPort, level: level, lastSeen: new Date().getTime()};
            setInterval(() => {
                runningApps[appName] = {app: appName, port: ioPort, level: level, lastSeen: new Date().getTime()};
                try {
                    rtserver.emit("attendance", {app: appName, port: ioPort, level: level});
                }
                catch(e){}

                //TODO remove all stale connections. Ones that were last seen more than PING_INTERVAL * 3
            }, PING_INTERVAL);  //update state every interval
        });
    }

    function tryConnect(){
        try{
            rtserver = require('socket.io')(10053);
            isRTServer = true;
            rtserver.on('connection', socket => {
                //console.log("Server connection");
                //send all known running apps to this socket
                let keys = Object.keys(runningApps);
                for( let key of keys ) {
                    if( new Date().getTime() - runningApps[key].lastSeen <= PING_INTERVAL * 3  ) { //send only those that are active
                        socket.emit("attendance", runningApps[key]);
                        //console.log("here");
                    }
                }
                socket.on('attendance', function(data){ //{app, port}
                    runningApps[data.app] = Object.assign({}, data, {lastSeen: new Date().getTime()});
                    socket.broadcast.emit("attendance", data);
                });
            });
        }
        catch(e){
            doClientConnect();
        }
    }

    function doClientConnect(){
        rtserver = require('socket.io-client')('http://localhost:10053');
        rtserver.on('connect', function(){
            //announce self to server
            rtserver.emit("attendance", {app: appName, port: ioPort, level: level, isFirst: true});
        });
        rtserver.on('attendance', function(data){ //{app, port}
            runningApps[data.app] = Object.assign({}, data, lastSeen: new Date().getTime());
        });
        rtserver.on('disconnect', tryConnect);
    }

    process.on('uncaughtException', function(err) {
        if(err.errno === 'EADDRINUSE'){
            doClientConnect();
        }
        else {
            console.error(err);
            process.exit(1);
        }
    });

    class Flow{
        constructor() {
            this.prev = null;    //The parent of this Flow
            this.next = null;    //The children of this Flow
            this.pipeFunc = (output) => output;    //The Pipe function to execute for this Flow
            this.rootFlow = null;   //The First Flow...to be used for push operations (Can be used for InFlow/OutFlow)
            this.terminalFunc = (output) => {}; //This is the Flow terminal function for a push operation. It is mostly for the last created Flow in the Flow chain.
            this.isDiscretized = false;
            this.channels = []; //Array of functions that can receive push data streams from this flow

            //TODO still under investigation...in beta
            this.elements = []; //The processed elements from this Flow. This saves them in memory for later reconstruction
            this.ended = false; //If we have seen the last of data for this Flow. This tells us when to take data from the elements cache
            this.elemPos = 0;   //The index position in the elements array that we currently are in

        }

        /**
         * This method uses the flow linking construct to trigger data processing
         * @returns {*}
         */
        process(){
            if( this.ended )
                return this._getElement();

            //because of the potential of reusing Flow as bases for others, we need to make sure
            //that when a Flow is being called, it is linked to the parent.
            if( this.prev.next != this )//if the parent was linked to another Flow, bring back the link
                this.prev.next = this;

            var obj = this.prev.process();
            if(obj == null)
                this._addElement(null);

            return obj;
        }

        startPush(){
            if( this.prev != null )
                this.prev.startPush();
        }

        stopPush(){
            if( this.prev != null )
                this.prev.stopPush();
        }

        //May be removed. Not currently used
        reset(){
            this.ended = false;
            this.elements = [];
        }

        /**
         * This method is used for the Pipeline operation.
         * It receives data from the previous Flow and channels the processed data to the next Flow (if any).
         * @param input the input from the previous Flow
         * @returns {*}
         */
        pipe(input){
            var outcome = this.pipeFunc(input);

            this._addElement(outcome);

            if( this.next !== null )
                return this.next.pipe(outcome);

            return outcome;
        }


        push(input){
            var outcome = this.pipeFunc(input);

            if( this.next !== null )
                this.next.push(outcome);
            else
                this.terminalFunc(outcome);

            this._sendToChannels(outcome);
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
         * This method is used to add a custom function for receiving push data
         * @param func
         */
        addChannel(func){
            if( Util.isFunction(func) )
                this.channels.push(func);
        }

        /**
         * Remove all push listeners
         */
        clearChannels(){
            this.channels = [];
        }

        _sendToChannels(input){
            this.channels.forEach(function(func){
                func(input);
            });
        }

        /**
         * Remove a custom function for receiving push data
         * @param func
         */
        removeChannel(func){
            if( !Util.isFunction(func) )
                return;

            for(var i = 0; i < this.channels.length; i++){
                if( this.channels[i] == func ){
                    this.channels.splice(i, 1);
                    break;
                }
            }
        }


        /**
         * This method create a Flow from several data types. Supported data types are: Array, Flow, Map, Set, Object, FileSystem, JAMLogger
         * @param data the data from which a Flow object would be created
         */
        static from(data){
            return FlowFactory.getFlow(data);
        }

        /**
         * This method creates a Flow using different modes from supplied arguments
         */
        static of(){
            if( arguments.length == 0 )
                return FlowFactory.getFlow([]);

            if( arguments.length > 1 )
                return FlowFactory.getFlow(arguments);

            if( arguments.length == 1 && Util.isNumber(arguments[0]) )
                return FlowFactory.createFlowWithEmptyArraysFromNumber(arguments[0]);

            return FlowFactory.getFlow(arguments[0]);
        }

        /**
         * This creates a Flow from a range of numbers. It is assumed that end > start
         * @param start the start number
         * @param end the end number
         */
        static fromRange(start, end){
            return FlowFactory.getFlow([...new Array(end - start + 1).keys()].map((elem) => elem + start));
        }

        /**
         * This is a direct method to create a Flow from file.
         * @param file the path to the file
         */
        static fromFile(file){
            return FlowFactory.createFlowFromFileSystem(file);
        }

        buildCallTree(){
            //TODO this method is supposed to build the call tree stack of this Flow from the IteratorFlow. Under investigation
            var prevTree = null, tree;
            if( this.prev !== null )
                prevTree = this.prev.buildCallTree();

            tree = {
                prev: prevTree,
                next: null,
                type: "flow",
                name: this.constructor.name,
                pipeFunc: this.pipeFunc,
                terminalFunc: this.terminalFunc,
                isDiscretized: this.isDiscretized,
                level: prevTree == null ? 0 : prevTree.level + 1
            };

            return tree;
        }

        /**
         * This method allows Flow creation from call tree definition
         * @param callTree the Flow call tree structure to build a Flow from
         */
        static buildFromCallTree(callTree){
            var lastIsAction = callTree.type == "action";   //if the last item in the callTree structure is a Flow Action

            var lastFlow, firstFlow, someFlow, tempFlow;
            if( lastIsAction )
                lastFlow = callTree.prev;
            else
                lastFlow = callTree;

            someFlow = lastFlow;

            while( someFlow.prev != null ) {
                tempFlow = someFlow.prev;
                tempFlow.next = someFlow;
                someFlow = someFlow.prev;
            }

            firstFlow = someFlow;

            var iteratorFlow = Flow.from([]);
            iteratorFlow.iterators = firstFlow.iterators;
            iteratorFlow.isDicretized = firstFlow.isDiscretized;

            someFlow = firstFlow.next;  //Flow json
            tempFlow = iteratorFlow;    //actual Flow
            var level = 0;  //the level of this flow. Level 0 is always IteratorFlow
            while( someFlow != null && someFlow.type != "action" ){
                switch(someFlow.name){
                    case "WhereMethodFlow":
                        tempFlow = tempFlow.where(someFlow.pipeFunc);
                        break;
                    case "SelectExpandFlattenMethodFlow":
                        tempFlow = tempFlow.selectExpand(someFlow.pipeFunc);
                        break;
                    //TODO add other types
                }

                tempFlow.level = level++;
                tempFlow.terminalFunc = someFlow.terminalFunc;

                someFlow = someFlow.next;
            }

            if( tempFlow == iteratorFlow )//if there are no flows attached to the iterator flow
                tempFlow.level = 0;

            var action = null;

            if( lastIsAction ){
                callTree.prev = null;
                action = callTree;
            }

            return {
                action: action,
                flow: tempFlow
            }
        }

        //Dummy function to be used by collect
        static toArray(){
            return "toArray";
        }

        //Dummy function to be used by collect
        static toSet(){
            return "toSet"
        }

        //Dummy function to be used by OrderBy
        static ASC(){
            return "ASC";
        }

        //Dummy function to be used by OrderBy
        static DESC(){
            return "DESC";
        }

        //Dummy function to be used by OrderBy
        static NUM_ASC(){
            return "NUM_ASC";
        }

        //Dummy function to be used by OrderBy
        static NUM_DESC(){
            return "NUM_DESC";
        }


        //*******************
        //   FLOW METHODS
        //*******************

        /**
         * This method restricts data operation to a certain number, starting from the first item it can see.
         * @param num the total number of items required.
         */
        limit(num){
            if( num <= 0 )
                throw new Error("Limit value must be greater than 0");

            var flow = new RangeMethodFlow(0, num);
            setRefs(this, flow);

            return flow;
        }

        /**
         * The number of elements to skip in the data stream
         * @param num the number of elements
         */
        skip(num){
            if( num <= 0 )
                throw new Error("Skip value must be greater than 0");

            var flow = new RangeMethodFlow(num, Number.MAX_VALUE);
            setRefs(this, flow);

            return flow;
        }

        /**
         * Skip until the condition in the function argument returns true
         * @param func the function which will test the input and return a boolean
         */
        skipUntil(func){
            if( !Util.isFunction(func) )
                throw new Error("skipUntil requires a function");

            var flow = new SkipTakeWhileUntilFlow(func, 1);
            setRefs(this, flow);

            return flow;
        }

        /**
         * Skip while the condition in the function argument returns true
         * @param func the function which will test the input and return a boolean
         */
        skipWhile(func){
            if( !Util.isFunction(func) )
                throw new Error("skipWhile requires a function");

            var flow = new SkipTakeWhileUntilFlow(func, 2);
            setRefs(this, flow);

            return flow;
        }

        /**
         * Keep accepting the piped data until the condition in the function argument returns true
         * This method also takes the data that meets the condition but skips after
         * @param func the function which will test the input and return a boolean
         */
        takeUntil(func){
            if( !Util.isFunction(func) )
                throw new Error("takeUntil requires a function");

            var flow = new SkipTakeWhileUntilFlow(func, 3);
            setRefs(this, flow);

            return flow;
        }

        /**
         * Keep accepting the piped data while the condition in the function argument returns true
         * @param func the function which will test the input and return a boolean
         */
        takeWhile(func){
            if( !Util.isFunction(func) )
                throw new Error("takeWhile requires a function");

            var flow = new SkipTakeWhileUntilFlow(func, 4);
            setRefs(this, flow);

            return flow;
        }


        /**
         * This create a data window to operate on
         * @param startIndex the starting point/index in the data stream...closely related to the amount of elements to skip
         * @param endIndex the ending point/index in the data stream.
         */
        range(startIndex, endIndex){
            if( startIndex < 0 )
                throw new Error("Start Index cannot be negative");
            if( endIndex <= 0 )
                throw new Error("End Index must be greater than 0");
            if( startIndex > endIndex )
                throw new Error("End Index cannot be less than Start Index");

            var flow = new RangeMethodFlow(startIndex, endIndex);
            setRefs(this, flow);

            return flow;
        }

        /**
         * This maps one or more parts of a data...as with Map-Reduce
         * @param func the mapping function
         */
        select(func){
            var flow = new Flow();
            if( Util.isFunction(func) )
                flow.pipeFunc = func;
            else{
                flow.pipeFunc = function(input){
                    return input[func];
                };
            }

            setRefs(this, flow);

            return flow;
        }

        /**
         * alias for select
         * @param func the mapping function
         * @returns {*}
         */
        map(func){
            return this.select(func);
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

        /**
         * Alias for where
         * @param func the filter function
         * @returns {*}
         */
        filter(func){
            return this.where(func);
        }

        static _sort(order){
            return function(a, b){
                if( order == "num_asc" )
                    return a - b;
                else if( order == "num_desc" )
                    return b - a;
                else {
                    if( a < b )
                        return order == "asc" ? -1 : 1;
                    if( a > b )
                        return order == "asc" ? 1 : -1;
                    return 0;
                }
            };
        }

        orderBy(func){
            if( !func )
                func = Flow._sort("asc");

            if( Util.isFunction(func) ) {
                if( func == Flow.ASC )
                    func = Flow._sort("asc");
                else if( func == Flow.DESC )
                    func = Flow._sort("desc");
                else if( func == Flow.NUM_ASC )
                    func = Flow._sort("num_asc");
                else if( func == Flow.NUM_DESC )
                    func = Flow._sort("num_desc");
            }
            else if( Util.isString(func) )
                func = Flow._sort(func.toLowerCase());

            var flow = new OrderByMethodFlow(func);
            setRefs(this, flow);

            return flow;
        }

        partitionBy(keyFunc){
            var groupFunc = keyFunc;
            if( !Util.isFunction(keyFunc) ) {
                groupFunc = function (input) {
                    return input[keyFunc];
                };
            }

            var flow = new PartitionByMethodFlow(groupFunc);
            setRefs(this, flow);

            return flow;
        }

        runningReduce(opts){
            var flow = new RunningReduceFlow(opts);
            setRefs(this, flow);

            return flow;
        }

        /**
         * This method discretizes a Flow
         * @param span how many data groups or streams the discretization should span
         * @param length the length of the window from the span
         * @param spawnFlows if the discretization should span array elements or DiscreteFlows
         */
        discretize(span, length, spawnFlows){
            if( spawnFlows === undefined )  //if this argument was not specified, we default to true
                spawnFlows = true;

            var flow = new DiscretizerFlow(span, getDataEndObject(length), spawnFlows);
            setRefs(this, flow);

            this.isDiscretized = true;

            return flow;
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
            var temp, _next;
            _next = this.next;
            this.next = null;

            while( (temp = this.process()) != null )
                total++;

            this.next = _next;

            return total;
        }

        //Function to be used by collect
        static toMap(keyFunc){
            var groupFunc = keyFunc;
            if( !Util.isFunction(keyFunc) ) {
                groupFunc = function (input) {
                    return input[keyFunc];
                };
            }

            return groupFunc;
        }

        _toSet(){
            var set = new Set();
            var data, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null )
                set.add(data);

            this.next = _next;

            return set;
        }

        _toArray(){
            var array = [];
            var data, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null )
                array.push(data);

            this.next = _next;

            return array;
        }

        /**
         * This method groups
         * @param keyFunc
         * @returns {{}}
         */
        groupBy(keyFunc){
            var groupFunc = keyFunc;
            if( !Util.isFunction(keyFunc) ) {
                groupFunc = function (input) {
                    return input[keyFunc];
                };
            }

            var data, group, groups = {}, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null ){
                group = groupFunc(data);
                if( !groups[group] )
                    groups[group] = [];

                groups[group].push(data);
            }

            this.next = _next;

            return groups;
        }

        /**
         * Join outputs by a delimiter and return a string
         * @param delim Optional delimiter. If none is provided, comma (,) is used
         * @returns {string} the joined string
         */
        join(delim){
            if( !delim )
                delim = ",";

            var joined = "", index = 0;
            var data, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null ) {
                if( index > 0 )
                    joined += delim;
                joined += data;
                index++;
            }

            this.next = _next;

            return joined;
        }


        /**
         * This method allows data collation to either an Array or a Set...a Map will be possible later
         * @param func either Flow.toArray or Flow.toSet
         * @returns {*} the data in the required format
         */
        collect(func){
            if( !func )
                return this._toArray();

            let isMap = false;

            if( Util.isFunction(func) ) {
                if( func == Flow.toArray )
                    return this._toArray();
                if( func == Flow.toSet )
                    return this._toSet();

                //this probably has to be collecting to a map
                isMap = true;
            }
            else if( Util.isString(func) ){
                if( func.toLowerCase() == "toarray" )
                    return this._toArray();
                if( func.toLowerCase() == "toset" )
                    return this._toSet();

                //this probably has to be collecting to a map
                isMap = true;
            }

            if( isMap ){
                let map = new Map();
                Flow.from(this.groupBy(func)).foreach((pair) => map.set(pair.key, pair.value));
                return map;
            }

            //use toArray as Default
            return this._toArray();
        }

        /**
         * This allows a custom operation on the data elements seen at the last Flow
         * @param func the custom function to operate on each element of the data collection
         */
        foreach(func){
            var data, _next, i = 0;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null )
                func(data, i++);

            this.next = _next;
        }

        /**
         * Alias of foreach for those familiar with the JS forEach
         * @param func
         */
        forEach(func){
            this.foreach(func);
        }

        anyMatch(func){
            var data, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null ){
                if( func(data) )
                    return true;
            }

            this.next = _next;

            return false;
        }

        allMatch(func){
            var data, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null ){
                if( !func(data) )
                    return false;
            }

            this.next = _next;

            return true;
        }

        noneMatch(func){
            return !this.anyMatch(func);
        }

        findFirst(){
            var obj, _next;
            _next = this.next;
            this.next = null;

            obj = this.process();

            this.next = _next;

            return obj;
        }

        findAny(){
            return this.findFirst();
        }

        findLast(){
            var data, found = null, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null )
                found = data;

            this.next = _next;

            return found;
        }

        sum(){
            var data, sum = 0, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null )
                sum += data;

            this.next = _next;

            return sum;
        }

        max(){
            var data, max = null, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null ){
                if( max == null || data > max )
                    max = data;
            }

            this.next = _next;

            return max;
        }

        min(){
            var data, min = null, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null ){
                if( min == null || data < min )
                    min = data;
            }

            this.next = _next;

            return min;
        }

        average(){
            var data, sum = 0, count = 0, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null ){
                sum += data;
                count++;
            }

            this.next = _next;

            return count == 0 ? 0 : sum / count;
        }

        reduce(init, func){
            var data, temp = init, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null )
                temp = func(temp, data);

            this.next = _next;

            return temp;
        }

        _addElement(elem){
            if( !this.rootFlow.shouldCache )    //if caching is not supported for this Flow chain
                return;

            if( !this.rootFlow.isStream() && !this.ended ) { //only save if we are not streaming and we have not ended the first iteration
                if( elem == null ){ //check if we have gotten to the end
                    this.ended = true;
                    return;
                }
                this.elements.push(elem);
            }
        }

        _getElement(){
            var obj;
            try {
                obj = this.elemPos < this.elements.length ? this.elements[this.elemPos] : null;
                return obj;
            }
            finally{
                this.elemPos++;
                if( obj == null )
                    this.elemPos = 0;
            }
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
     * This is the first Flow that will be created from the data types and does most of the heavy lifting.
     * The major difference between this class and the Flow class is that the process method in this class
     * does same thing as the pipe method in the Flow class
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
            this.isListening = false;   //If this has started listening for new data (push mode)
            this.subscribers = {};  //the stream-key/function map of function which will be called when a new data is received on the stream

            this.streamElements = [];   //This is where we will store the stream elements till we get to the window end
            this.discreteStreamLength = 1;  //The number of streams to iterate through for the discretization
            this.discreteStreams = [];  //The streams for discretization. The user could pass an array of streams as opposed to length/span
            this.isDataEndObject = {isDataEnd: (data) => false};   //A object that implements the isDataEnd The function to check if we have gotten to the end of a discrete stream
            this.recall = {};   //any variable that needs to be remembered will plug in here.

            this.isParallel = false;    //If this IteratorFlow is under a ParallelFlow instance
            this.pFlow = null;  //A reference to the parallel flow housing this iterator flow (if any)

            this.shouldCache = false;    //If the Flows should save processed data
        }

        /**
         * This method is used to determine if data is push on this IteratorFlow as a stream or data is pulled for static content
         * @returns boolean a value that determines if this Flow is for stream processing
         */
        isStream(){
            return this.iterators.length > 0 && (this.iterators[0].logger || this.iterators[0].stream);
        }

        /**
         * The process method will act like the pipe method in the default Flow class (but without an input)
         */
        process(){
            if (this.pos >= this.iterators.length) {
                this.pos = 0;
                return null;
            }

            if( !this.isDiscretized ) {
                //##go through the iterators one after the other##

                //get the data from the current iterator
                var obj = this.iterators[this.pos].next();

                //check for the next iterator that has data
                while (obj.done && this.pos < this.iterators.length) {
                    this.pos++;
                    if (this.pos >= this.iterators.length)
                        break;

                    obj = this.iterators[this.pos].next();
                }

                if (obj.done) {
                    this.pos = 0;
                    return null;
                }

                if (this.next !== null)
                    return this.next.pipe(obj.value);
                return obj.value;
            }
            else{//for discretized flows
                //we use this instead of the streamElements cause we don't need to save state.
                //Also, clearing streamElements could affect implementations storing the output
                var streamData = [];

                //ensure that our discrete stream length is not more than the number of iterators we have
                this.discreteStreamLength = Math.min(this.discreteStreamLength, this.iterators.length);
                if( this.discreteStreams.length > 0 )

                if( this.discreteStreamLength == 1 ){//operate on one stream first and then move to the next
                    obj = this.iterators[this.pos].next();

                    //check for the next iterator that has data
                    while (obj.done && this.pos < this.iterators.length) {
                        this.pos++;
                        if (this.pos >= this.iterators.length)
                            break;

                        obj = this.iterators[this.pos].next();
                    }

                    if (obj.done) {
                        this.pos = 0;
                        return null;
                    }

                    while( !obj.done ){
                        streamData.push(obj.value);

                        if( this.isDataEndObject.isDataEnd(obj.value, streamData.length) ){
                            if (this.next !== null)
                                return this.next.pipe(streamData);
                            return streamData;
                        }

                        obj = this.iterators[this.pos].next();
                    }

                    //At this point, if we have elements in the stream, we fill it will nulls since we are instructed to
                    //discretize with one iterator
                    if( streamData.length > 0 ){
                        while(true) {
                            streamData.push(null);
                            if( this.isDataEndObject.isDataEnd(obj.value, streamData.length) ){
                                if (this.next !== null)
                                    return this.next.pipe(streamData);
                                return streamData;
                            }
                        }
                    }
                }
                else{
                    if( !this.recall.ended ) {
                        this.recall.ended = []; //we need this since the iterators reset...we need to know the ones that have ended
                        //a flag that states if the last check was data end. Because we cannot peek into the iterator, we have to
                        //waste one round of iteration to discover that they have all ended which will create null data.
                        this.recall.justEnded = false;

                        for (let i = 0; i < this.discreteStreamLength; i++) {
                            this.recall.ended.push(false);
                        }
                    }

                    do{
                        //check if all items have ended
                        if( this.recall.justEnded && Flow.from(this.recall.ended).allMatch((input) => input) )
                            break;

                        var pack = [];

                        for(let i = 0; i < this.discreteStreamLength; i++){
                            if( this.recall.ended[i] )
                                pack[i] = null;
                            else {
                                obj = this.iterators[i].next();
                                if( obj.done ) {
                                    this.recall.ended[i] = true;
                                    pack[i] = null;
                                }
                                else
                                    pack[i] = obj.value;
                            }
                        }

                        //check if we just ended on the last iteration and this current sets of data are just nulls
                        if( this.recall.justEnded && Flow.from(pack).allMatch((input) => input == null) )
                            break;

                        this.streamElements.push(pack);

                        if( this.isDataEndObject.isDataEnd(pack, this.streamElements.length) ){
                            this.recall.justEnded = true;

                            try {
                                if (this.next !== null)
                                    return this.next.pipe(this.streamElements.slice());
                                return this.streamElements.slice();
                            }
                            finally{
                                this.streamElements = [];
                            }
                        }
                        else
                            this.recall.justEnded = false;
                    }while(true);

                    this.pos = 0;    //reset the pos variable to allow for reuse

                    //clear temp fields
                    delete this.recall.ended;
                    delete this.recall.justEnded;
                    //reset temp stream storage variable
                    this.streamElements = [];

                    return null;
                }
            }
        }

        /**
         * This methods merges another data input on the current stream. It is only available to IteratorFlow
         * We can not merge datastreams/datasources with other data types
         * @param data the object to create an IteratorFlow from (more like the output from 'Flow.from')
         */
        merge(data){
            var isStream = this.isStream();

            var iterators = FlowFactory.getFlow(data).iterators;//we are only interested in the iterators in this new Flow
            for(let iterator of iterators) {
                //ensure that we cannot mix streams and static data structures
                if( (!isStream && (iterator.logger || iterator.stream))
                    || (isStream && !(iterator.logger || iterator.stream)) )
                    throw new Error("Datastreams/Datasources cannot be merged with other data types");

                this.iterators.push(iterator);
            }

            return this;
        }

        startPush(){
            if( this.isListening )
                return;

            this.isListening = true;

            if( this.iterators[0].logger || this.iterators[0].stream || hasDiscreteStreams(this.discreteStreams) )  //if this is a datastream/logger
                this._listen();
            else
                this._doPush();
        }

        stopPush(){
            if( !this.isListening )
                return;

            this.isListening = false;
            var self = this;

            if( hasDiscreteStreams(this.discreteStreams) )
                Flow.from(this.discreteStreams).forEach(stream => unsubscribeFromStream(stream, self));
            else if( this.iterators[0].logger || this.iterators[0].stream ){ //if this is a datastream/logger
                for( let iterator of this.iterators ){
                    if( iterator.logger ){//if this iterator was a datasource/logger
                        if( !this.isDiscretized ){//we subscribe to the datasource for non-discretized streams
                            unsubscribeFromStream(iterator.logger, this);
                            continue;
                        }

                        var obj;

                        while( true ){
                            obj = iterator.next();  //obj.value is a datastream
                            if( obj.done )
                                break;

                            unsubscribeFromStream(obj.value, this);
                        }
                    }
                    else if( iterator.stream )//if this iterator was a datastream
                        unsubscribeFromStream(iterator.stream, this);
                }
            }
        }

        /**
         * This method is used by OutFlow to trigger the start of a push flow for finite data and for JS generators
         */
        _doPush(){//This works best for streaming from filesystem (since it is static/finite) and JS generators too...
            var obj;

            if( !this.isDiscretized ) {
                while(true) {
                    if (!this.isListening || this.pos >= this.iterators.length)
                        break;
                    //get the data from the current iterator
                    obj = this.iterators[this.pos].next();

                    //check for the next iterator that has data
                    while (obj.done && this.pos < this.iterators.length) {
                        this.pos++;
                        if (this.pos >= this.iterators.length)
                            break;

                        obj = this.iterators[this.pos].next();
                    }

                    if (obj.done)
                        break;

                    this.push(obj.value);
                }
            }
            else{//for discretized flows
                //ensure that our discrete stream length is not more than the number of iterators we have
                this.discreteStreamLength = Math.min(this.discreteStreamLength, this.iterators.length);

                if( this.discreteStreamLength == 1 ){//operate on one stream first and then move to the next
                    do{
                        obj = this.iterators[this.pos].next();
                        while( !obj.done ){
                            this.streamElements.push(obj.value);

                            if( this.isDataEndObject.isDataEnd(obj.value, this.streamElements.length) ){
                                this.push(this.streamElements.slice());
                                this.streamElements = [];
                            }

                            obj = this.iterators[this.pos].next();
                        }

                        //At this point, if we have elements in the stream, we fill it will nulls since we are instructed to
                        //discretize with one iterator
                        if( this.streamElements.length > 0 ){
                            while(true) {
                                this.streamElements.push(null);
                                if( this.isDataEndObject.isDataEnd(obj.value, this.streamElements.length) ){
                                    this.push(this.streamElements.slice());
                                    this.streamElements = [];
                                    break;
                                }
                            }
                        }

                        this.pos++;
                    }while( this.pos < this.iterators.length );
                }
                else{
                    var ended = []; //we need this since the iterators reset...we need to know the ones that have ended
                    //a flag that states if the last check was data end. Because we cannot peek into the iterator, we have to
                    //waste one round of iteration to discover that they have all ended which will create null data.
                    var justEnded = false;

                    for(let i = 0; i < this.discreteStreamLength; i++){
                        ended.push(false);
                    }

                    do{
                        var pack = [];

                        for(let i = 0; i < this.discreteStreamLength; i++){
                            if( ended[i] )
                                pack[i] = null;
                            else {
                                obj = this.iterators[i].next();
                                if( obj.done ) {
                                    ended[i] = true;
                                    pack[i] = null;
                                }
                                else
                                    pack[i] = obj.value;
                            }
                        }

                        //check if we just ended on the last iteration and this current sets of data are just nulls
                        if( justEnded && Flow.from(pack).allMatch((input) => input == null) )
                            break;

                        this.streamElements.push(pack);

                        if( this.isDataEndObject.isDataEnd(pack, this.streamElements.length) ){
                            justEnded = true;
                            this.push(this.streamElements.slice());
                            this.streamElements = [];

                            //check if all items have ended
                            if( Flow.from(ended).allMatch((input) => input) )
                                break;
                        }
                        else
                            justEnded = false;
                    }while(true);
                }
            }

            this.isListening = false;   //we done processing so stop listening
            this.pos = 0;   //reset the pos for other operations
        }

        /**
         * Register to listen for data changes in loggers and streams and push elements through the Flow chain
         * This method is called by startPush when the push operation is required to start listening for
         * data changes in the datastreams
         */
        _listen(){
            if( this.isDiscretized ) {//for discretized flows...maintain the subscription state for consistency
                var streams = [];   //the order with which we should arrange data in discretized flows

                if( hasDiscreteStreams(this.discreteStreams) ) {
                    streams = this.discreteStreams.slice(0);
                    for(let stream of streams)
                        subscribeToStream(stream, this);
                }
                else {
                    for (let iterator of this.iterators) {
                        if (iterator.logger) {//if this iterator was a datasource/logger
                            var obj;

                            while (true) {
                                obj = iterator.next();  //obj.value is a datastream
                                if (obj.done)
                                    break;

                                streams.push(obj.value);
                                subscribeToStream(obj.value, this);
                            }
                        }
                        else if (iterator.stream) {//if this iterator was a datastream
                            streams.push(iterator.stream);
                            subscribeToStream(iterator.stream, this);
                        }
                    }
                }

                //set up the basics for a discretized push
                //this.recall.streams = streams;  //save the order in recall
                this.recall.streamKeys = Flow.from(streams).select((stream) => stream.key).collect();
                this.recall.queues = Flow.from(streams).select((stream) => new Queue()).collect();
                this.discreteStreamLength = Math.min(streams.length, this.discreteStreamLength);    //ensure minimum
                this.recall.ready = true;   //a flag that ensures we do not have more than one setTimeout function in queue
                this.recall.called = false; //if we have called the setTimeout function at least once
                this.streamElements = [];
            }
            else{//subscribe to datasources and streams. datasources will be responsible for their stream subscription
                for (let iterator of this.iterators) {
                    if (iterator.logger)
                        subscribeToStream(iterator.logger, this);
                    else if( iterator.stream )
                        subscribeToStream(iterator.stream, this);
                }
            }
        }

        _prePush(input, stream){
            if( !this.isDiscretized )
                this.push(input);
            else{//for discretized streams
                //add item to queue
                this.recall.queues[this.recall.streamKeys.indexOf(stream.key)].enqueue(input);

                var self = this;

                if( !this.recall.ready )
                    return;

                this.recall.ready = false;

                //use a set timeout to allow opportunity for several push
                setTimeout(function(){
                    Outer:
                    do {
                        //check if we have enough for a push
                        var pack = [];
                        for (let i = 0; i < self.discreteStreamLength; i++) {
                            if (self.recall.queues[i].isEmpty())
                                break Outer;

                            pack.push(self.recall.queues[i].dequeue());
                        }

                        self.streamElements.push(pack);

                        if (self.isDataEndObject.isDataEnd(pack, self.streamElements.length)) {
                            self.push(self.streamElements.slice());
                            self.streamElements = [];
                        }
                    }
                    while(true);

                    self.recall.called = true;
                    self.recall.ready = true;
                }, this.recall.called ? 0 : 1000);  //wait a second before the first start to allow for old data to pass through
            }
        }

        push(input){
            if( !this.isListening )//if we are to stop listening for push data
                return;

            this.next !== null ? this.next.push(input) : this.terminalFunc(input);
            this._sendToChannels(input);
        }

        /**
         * This method makes the IteratorFlow discretizable.
         * @param span The number of streams/iterators to look at in the window.
         *      'streams' value of 1 means that we focus on only one stream for the window size and move to the next stream.
         *      'streams' value greater than 1 means that we should do a round-robin based on the specified number
         *          and then move to the next stream(s) and do the same, operating on the data based on the specified length
         *      span can also be an array of datastreams which the discretization should be done against
         * @param spanLength The window length. The length of data to be treated as one (a block).
         *      The length could be a function that determines when we have gotten to the last item.
         *      This could be used for custom time-based discretization. So data could be split based on time.
         * @param spawnFlows if we should spawn DiscreteFlows as output
         */
        discretize(span, spanLength, spawnFlows){
            if( spawnFlows === undefined )
                spawnFlows = true;

            if( hasDiscreteStreams(span) ){
                this.discreteStreams = span;
                this.discreteStreamLength = span.length;
            }
            else
                this.discreteStreamLength = span;

            this.isDataEndObject = getDataEndObject(spanLength);
            this.isDiscretized = true;

            var flow = new DiscretizerFlow(span, this.isDataEndObject, spawnFlows);
            setRefs(this, flow);

            return flow;
        }

        buildCallTree(){
            var callTree = super.buildCallTree();
            callTree.iterators = this.iterators;

            return callTree;
        }
    }

    /**
     * This method subscribes a Flow (IteratorFlow) to a datastream to listen for data changes
     * This method is placed outside the class to prevent external access
     * @param stream the datastream/datasource to subscribe to
     * @param flow the IteratorFlow object which will initiate the push
     */
    function subscribeToStream(stream, flow){
        var func = function(key, entry, datastream){
            var obj = {
                key: Util.buildKeyObject(key),
                data: entry.log,
                timestamp: entry.time_stamp
            };
            setTimeout(() => flow._prePush(obj, datastream ? datastream : stream), 0);
        };

        stream.subscribe(func);
        flow.subscribers[stream.key] = func;
    }

    function unsubscribeFromStream(stream, flow){
        if( flow.subscribers[stream.key] ) {
            stream.unsubscribe(flow.subscribers[stream.key]);
            delete flow.subscribers[stream.key];    //delete this stream handle from the subscribers list
        }
    }

    function getDataEndObject(spanLength){
        var obj;

        if( Util.isNumber(spanLength) ){
            obj = (function(l){
                var length = l;
                var pos = 0;

                return {
                    /**
                     *
                     * @param data is the data that has just been added
                     * @param dataLength this is the current length of the array holding the discretized data
                     * @returns {boolean}
                     */
                    isDataEnd: function(data, dataLength){
                        try {
                            if (pos < length - 1)
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
            })( Math.ceil(spanLength) );
        }
        else if( Util.isFunction(spanLength) ){
            obj = (function(lengthFunc){
                return {
                    isDataEnd: lengthFunc
                };
            })(spanLength);
        }
        else if( spanLength.isDataEnd && Util.isFunction(spanLength.isDataEnd) )
            obj = spanLength;
        else
            throw new Error("Span length can be either a Number, a function or an object with an 'isDataEnd' function");

        return obj;
    }

    function hasDiscreteStreams(array){
        if( !Util.isArray(array) || array.length === 0 )
            return false;
        return Flow.from(array).allMatch(elem => Util.isDataStream(elem));
    }




    /**
     * This class is used to create Flows that flatten and expand data based on selectFlatten and selectExpand respectively
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
            if( this.ended )
                return this._getElement();

            //establish link from parent to this Flow
            if( this.prev.next != this )//if the parent was linked to another Flow, bring back the link
                this.prev.next = this;

            var obj;

            if( this.iteratorFlow == null ) {
                obj = this.prev.process();
                if( obj == null )
                    this._addElement(null);
                return obj;
            }

            obj = this.iteratorFlow.process();
            if( obj == null ){
                this.iteratorFlow = null;
                obj = this.prev.process();
                if( obj == null )
                    this._addElement(null);
                return obj;
            }

            this._addElement(obj);

            if( this.next !== null )
                return this.next.pipe(obj);

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
                this._sendToChannels(output);
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
            if (this.position < this.end) {
                this.position++;

                if (this.position <= this.start) {
                    var obj = this.prev.process();
                    if(obj == null)
                        this._addElement(null);

                    return obj;
                }
                // while(this.position <= this.start){
                //     input = this.prev.process();
                //     this.position++;
                // }

                this._addElement(input);

                if (this.next !== null)
                    return this.next.pipe(input);
                else
                    return input;
            }
            else {
                //reset the position for reuse
                this.position = 0;

                this._addElement(null);
                return null;
            }
        }

        push(input){
            if( this.position < this.end ){
                this.position++;

                if( this.position <= this.start || this.position >= this.end ) {
                    return;
                }

                this.next !== null ? this.next.push(input) : this.terminalFunc(input);
                this._sendToChannels(input);
            }
        }

        buildCallTree(){
            var tree = super.buildCallTree();
            if( this.start == 0 ){  //limit
                tree.name = "limit";
                tree.limit = this.end;
                return tree;
            }
            else if( this.end == Number.MAX_VALUE ){    //skip
                tree.name = "skip";
                tree.skip = this.start;
                return tree;
            }

            //it must be range...lets split into skip and limit
            tree.name = "skip";
            tree.skip = this.start;
            tree.isDiscretized = false; //if the range was discretized, we do the discretization in the limit

           return {
                prev: tree,
                next: null,
                type: "flow",
                name: "limit",
                pipeFunc: this.pipeFunc,
                terminalFunc: this.terminalFunc,
                isDiscretized: this.isDiscretized,
                level: tree.level + 1,
                limit: this.end - this.start
            };
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

            this._addElement(input);

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
            this._sendToChannels(input);
        }
    }


    /**
     *
     */
    class OrderByMethodFlow extends Flow{
        constructor(func){
            super();
            this.pipeFunc = func;
            this.items = [];    //the items to sort
            this.obtainedAll = false;
            this.pos = 0;
        }

        process(){
            if( this.ended )
                return this._getElement();

            //establish link from parent to this Flow
            if( this.prev.next != this )//if the parent was linked to another Flow, bring back the link
                this.prev.next = this;

            var obj;

            if( !this.obtainedAll ){
                obj = this.prev.process();
                if (obj != null)
                    return obj;

                this.obtainedAll = true;

                this.items.sort(this.pipeFunc);
            }

            //at this point we have obtained all
            if( this.pos < this.items.length )
                obj = this.items[this.pos++];
            else{
                //save the items for reuse
                this.elements = this.items.slice();
                this.ended = true;
                this.elemPos = 0;

                //reset items for restarting
                this.pos = 0;
                this.items = [];
                this.obtainedAll = false;

                return null;
            }

            if( this.next !== null )
                return this.next.pipe(obj);
            return obj;
        }

        pipe(input){
            this.items.push(input);
            return this.process();
        }

        //we cannot sort in a push
        push(input){
            this.next !== null ? this.next.push(input) : this.terminalFunc(input);
            this._sendToChannels(input);
        }
    }


    /**
     * The partitionBy method class Flow definition
     */
    class PartitionByMethodFlow extends Flow{
        constructor(func){
            super();
            this.pipeFunc = func;
            this.partitions = {};
            this.obtainedAll = false;
            this.iterator = null;   //used for iterating through the partitions
        }

        process(){
            if( this.ended )
                return this._getElement();

            //establish link from parent to this Flow
            if( this.prev.next != this )//if the parent was linked to another Flow, bring back the link
                this.prev.next = this;

            var obj;

            if( !this.obtainedAll ){
                obj = this.prev.process();
                if (obj != null)
                    return obj;

                this.obtainedAll = true;

                this.iterator = FlowFactory.createFlowFromObject(this.partitions).iterators[0];
            }

            obj = this.iterator.next();
            if( obj.done ){
                this._addElement(null);

                //reset for reusing
                this.iterator = null;
                this.obtainedAll = false;
                return null;
            }

            obj = obj.value;

            this._addElement(obj);

            if( this.next !== null )
                return this.next.pipe(obj);
            return obj;
        }

        pipe(input){
            var partition = this.pipeFunc(input);
            if( !this.partitions[partition] )
                this.partitions[partition] = [];
            this.partitions[partition].push(input);

            return this.process();
        }

        //one of two options for push: we either simply let the data pass through or
        //we apply the group functions and send the data on as an object with {group: name, data: input}
        //going with the first till i hear/feel otherwise.
        push(input){
            this.next !== null ? this.next.push(input) : this.terminalFunc(input);
            this._sendToChannels(input);
        }
    }


    /**
     * This class is responsible for the following methods:
     * skipUntil, skipWhile, takeUntil, takeWhile
     */
    class SkipTakeWhileUntilFlow extends Flow{
        constructor(func, method){
            super();
            this.pipeFunc = func;
            this.method = method;   //1=skipUntil, 2=skipWhile, 3=takeUntil, 4=takeWhile
            this.finished = false;
        }

        pipe(input){
            var obj;

            switch(this.method){
                case 1: //skipUntil
                    if( this.finished || this.pipeFunc(input) ) {//condition has been met for skipUntil...we no longer skip
                        this.finished = true;   //flag that we do not need to check the pipe function test
                        obj = input;
                    }
                    else {
                        obj = this.prev.process();
                        if (obj == null)
                            this._addElement(obj);
                        return obj;
                    }
                    break;
                case 2: //skipWhile
                    if( !this.finished && this.pipeFunc(input) ){
                        obj = this.prev.process();
                        if (obj == null)
                            this._addElement(obj);
                        return obj;
                    }
                    else{
                        this.finished = true;   //flag that we do not need to check the pipe function test
                        obj = input;
                    }
                    break;
                case 3: //takeUntil
                    if( this.finished || this.pipeFunc(input) ){
                        if( !this.finished )    //also take the one that meets the condition
                            obj = input;
                        else
                            obj = null;
                        this.finished = true;
                    }
                    else
                        obj = input;
                    break;
                case 4: //takeWhile
                    if( !this.finished && this.pipeFunc(input) )
                        obj = input;
                    else{
                        this.finished = true;
                        obj = null;
                    }
            }

            this._addElement(obj);

            if (obj == null) {
                this.finished = false;  //reset for reuse
                return null;
            }

            if( this.next !== null )
                return this.next.pipe(obj);
            return obj;
        }

        push(input){
            var obj;

            switch(this.method){
                case 1: //skipUntil
                    if( this.finished || this.pipeFunc(input) ) {//condition has been met for skipUntil...we no longer skip
                        this.finished = true;   //flag that we do not need to check the pipe function test
                        obj = input;
                    }
                    else
                        return;
                    break;
                case 2: //skipWhile
                    if( !this.finished && this.pipeFunc(input) )
                        return;
                    else{
                        this.finished = true;   //flag that we do not need to check the pipe function test
                        obj = input;
                    }
                    break;
                case 3: //takeUntil
                    if( this.finished || this.pipeFunc(input) ){
                        if( !this.finished ) {    //also take the one that meets the condition
                            obj = input;
                            this.finished = true;
                        }
                        else
                            return;
                    }
                    else
                        obj = input;
                    break;
                case 4: //takeWhile
                    if( !this.finished && this.pipeFunc(input) )
                        obj = input;
                    else{
                        this.finished = true;
                        return;
                    }
            }

            this.next !== null ? this.next.push(obj) : this.terminalFunc(obj);
            this._sendToChannels(obj);
        }
    }


    /**
     * The job of this class is to create DiscretizedFlows
     */
    class DiscretizerFlow extends Flow{
        constructor(span, isDataEndObject, spawnFlows){
            super();
            //this.streams = hasDiscreteStreams(span) ? span : [];
            this.span = hasDiscreteStreams(span) ? span.length : (span > 0 ? span : 1);
            this.isDataEndObject = isDataEndObject; //the object with the function that allows us to determine if we have gotten to the end of a window
            this.spawnFlows = spawnFlows;
            this.elements = [];  //this are saved data which are used to create a Discretized Flow
        }

        process(){
            //establish link from parent to this Flow
            if( this.prev.next != this )//if the parent was linked to another Flow, bring back the link
                this.prev.next = this;

            return this.prev.process();
        }

        pipe(input){
            if( this.prev instanceof IteratorFlow && !this.isDiscretized ) //Don't do any more work...it has been discretized from IteratorFlow
                this.elements = input;
            else {
                var toAdd = input;

                if (this.span == 1) {
                    this.elements.push(toAdd);

                    //check if we have gotten to the end of a discrete flow.
                    if (!this.isDataEndObject.isDataEnd(toAdd, this.elements.length))
                        return this.prev.process();
                }
                else {
                    if (!Util.isArray(input)) {
                        var iteratorFlow = FlowFactory.getFlow(input);
                        toAdd = [];
                        var seenNull = false, item;
                        for (let i = 0; i < this.span; i++) {
                            if (seenNull)
                                toAdd.push(null);
                            else {
                                item = iteratorFlow.process();
                                toAdd.push(item);
                                //the implementation of Flow allows resetting after a Null so we need this to avoid it restarting
                                //from the beginning after a null
                                if (item == null)
                                    seenNull = true;
                            }
                        }
                        iteratorFlow = null;
                    }
                    else {//regularize the array to be same size as span
                        if (this.span < toAdd.length)
                            toAdd.splice(this.span);
                        else if (this.span > toAdd.length) {
                            while (this.span != toAdd.length)
                                toAdd.push(null);
                        }
                    }

                    this.elements.push(toAdd);

                    if (!this.isDataEndObject.isDataEnd(toAdd, this.elements.length))
                        return this.prev.process();
                }
            }


            var obj;
            if( this.spawnFlows )
                obj = new DiscretizedFlow(this.elements);
            else
                obj = this.elements;

            try {
                if (this.next !== null)
                    return this.next.pipe(obj);

                return obj;
            }
            finally{
                this.elements = [];
            }
        }

        push(input){
            if( this.prev instanceof IteratorFlow && !this.isDiscretized ) //Don't do any more work...it has been discretized from IteratorFlow
                this.elements = input;
            else {
                var toAdd = input;

                if (this.span == 1) {
                    this.elements.push(input);

                    //check if we have gotten to the end of a discrete flow.
                    if (!this.isDataEndObject.isDataEnd(input, this.elements.length))
                        return;
                }
                else {
                    if (!Util.isArray(input)) {
                        var iteratorFlow = FlowFactory.getFlow(input);
                        toAdd = [];
                        var seenNull = false, item;
                        for (let i = 0; i < this.span; i++) {
                            if (seenNull)
                                toAdd.push(null);
                            else {
                                item = iteratorFlow.process();
                                toAdd.push(item);
                                //the implementation of Flow allows resetting after a Null so we need this to avoid it restarting
                                //from the beginning after a null
                                if (item == null)
                                    seenNull = true;
                            }
                        }
                        iteratorFlow = null;
                    }
                    else {//regularize the array to be same size as span
                        if (this.span < toAdd.length)
                            toAdd.splice(this.span);
                        else if (this.span > toAdd.length) {
                            while (this.span != toAdd.length)
                                toAdd.push(null);
                        }
                    }

                    this.elements.push(toAdd);

                    if (!this.isDataEndObject.isDataEnd(toAdd, this.elements.length))
                        return;
                }
            }

            var obj;
            if( this.spawnFlows )
                obj = new DiscretizedFlow(this.elements);
            else
                obj = this.elements;


            if (this.next !== null)
                this.next.push(obj);
            else
                this.terminalFunc(obj);

            this._sendToChannels(obj);

            this.elements = [];
        }
    }

    class DiscretizedFlow extends IteratorFlow{
        /**
         *
         * @param elements an array of elements from the DiscretizerFlow
         */
        constructor(elements){
            super(FlowFactory.createFlowFromArray(elements).iterators[0]);
            this.elements = elements;
        }

        elementSize(){
            return this.elements.length;
        }

        streamSize(){
            try {
                return this.elements[0].length;
            }
            catch(e){
                return 1;
            }
        }
    }

    class RunningReduceFlow extends Flow{
        constructor(opts){
            super();
            this._count = 0;
            this._sum = 0;
            this._min = null;
            this._max = null;
            this._first = null;
            this._last = null;
            this.custom = null;
            this.opts = opts;
            this.optsCopy = Object.assign({}, opts);

            this._regularize("sum");
            this._regularize("min");
            this._regularize("max");
        }

        _regularize(func){
            if( this.opts[func] !== undefined ){
                if( this.opts[func] === null ){
                    this.opts[func] = elem => elem - 0;
                }
                else if( !Util.isFunction(this.opts[func]) ){
                    this.opts[func] = elem => elem[this.optsCopy[func]] - 0;
                }
            }
        }

        push(input){
            this._count++;
            this._last = input;
            if( this._first === null )
                this._first = input;

            if( this.opts.sum )
                this._sum += this.opts.sum(input);

            if( this.opts.min )
                this._min = this._min === null ? this.opts.min(input) - 0 : Math.min(this._min, this.opts.min(input) - 0);

            if( this.opts.max )
                this._max = this._max === null ? this.opts.max(input) - 0 : Math.max(this._max, this.opts.max(input) - 0);

            if( this.opts.custom )
                this.custom = this.opts.custom(this.custom, input);


            if (this.next !== null)
                this.next.push(input);
            else
                this.terminalFunc(input);

            this._sendToChannels(input);
        }

        getFirst(){
            return this._first;
        }

        getLast(){
            return this._last;
        }

        getAverage(){
            return this._sum === 0 ? 0 : this._sum / this._count;
        }

        getSum(){
            return this._sum;
        }

        getCount(){
            return this._count;
        }

        getMin(){
            return this._min;
        }

        getMax(){
            return this._max;
        }

        getCustomResult(){
            return this.custom;
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
        constructor(app, varName, jammanager){
            super();

            //build key object
            this.key = {
                app: app,
                flow: varName
            };

            this.lastValueIndex = 0;
            this.isBusy = false;
            this.hasData = false;

            if( Manager )
                jammanager = Manager;
            if( !jammanager )
                jammanager = (require('jamserver')(true)).JAMManager;
            this.manager = jammanager;


            this._fetch();  //fetch any data which may have already existed before the inflow was started
            //subscribe for changes
            this.manager.subscribe(this.key, this);
        }

        /**
         * This method received notification from the Manager subscription
         * @param keyObject the object representation of the key that had a generated event
         */
        notify(keyObject){
            var key = Util.buildKey(keyObject);

            this._fetch();
        }

        getSize(){
            return this.lastValueIndex;
        }

        setSize(val){
            this.lastValueIndex = val;
        }

        _fetch(){
            if( this.isBusy ){
                this.hasData = true;
                return;
            }
            this.isBusy = true;
            this.hasData = false;

            var self = this;
            //retrieve data from redis for the key...from the last known state
            this.manager.redis.rawCall(['ZRANGE', Util.buildKey(this.key), this.lastValueIndex, -1], function(e, response){
                if( e ) {
                    self.isBusy = false;
                    throw new Error(e);
                }

                var parts, pack;
                for (var i = 0; i < response.length; i++) {
                    self.lastValueIndex++;

                    parts = response[i].split(self.manager.delimiter);

                    //strip off the message wrapper and push
                    self.push(JSON.parse(parts[0]).entry);
                }

                let hasData = self.hasData;
                self.isBusy = false;
                if( hasData )
                    self._fetch();
            });
        }

        //regularize InFlow if it is chained for piping
        process(){
            return null;
        }

        getKey(){
            return this.key;
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
         * @param jammanager a JAMManager object
         */
        constructor(varName, source, jammanager){
            super();

            if( Util.isLogger(source) ){
                console.warn("source for the Outflow - " + varName + " is a logger. Defaulting to IteratorFlow");
                source = Flow.from(source);
            }

            if( !(source instanceof Flow) )//check if source is a Flow
                throw new Error("Source is NOT a Flow");

            if( Manager )
                jammanager = Manager;
            if( !jammanager )
                jammanager = (require('jamserver')(true)).JAMManager;
            this.manager = jammanager;

            //build key object
            this.key = {
                app: this.manager.app,
                flow: varName
            };

            this.source = source;
            setRefs(source, this);  //Create a link from the source flow to this flow so that we receive push data
            this.pipeFunc = (input) => input;   //Create a default function to regularize the Flow design
            this.transformer = (input) => input;    //This function will be used to transform the outflow data if required
            this.tracker = 1;   //value to make the entries unique
        }

        setExtractDataTransformer(){
            return this.setTransformer(input => input.data);
        }

        setTransformer(func){
            if( Util.isFunction(func) )
                this.transformer = func;
            return this;    //so it can be used to chain method calls in a single line if needed
        }

        start(){
            if( this.rootFlow != null )
                this.rootFlow.startPush();
        }

        stop(){
            if( this.rootFlow != null )
                this.rootFlow.stopPush();
        }

        push(input){
            input = this.transformer(input);    //transform input before sending off

            //wrap entry
            input = {
                tracker: this.tracker++,
                entry: input
            };

            this.manager.simpleLog(this.key, input, (response) => {
                if( !response.status )
                    console.log(response.error);
            });
            this._sendToChannels(input);
        }
    }



    class RealtimeFlow extends Flow{
        /**
         * JDdata Def: channel as rtflow of source to app using callback
         *
         * @param app The name of the next app to connect to
         * @param channel The channel for the communication between the apps. Should be unique
         * @param source Optional Flow object with streaming features (e.g. loggers) which will send the data across the channel
         * @param callback Optional callback function to receive data from the other side of the connection.
         */
        constructor(app, channel, source, callback){    //connect to app on this channel: avrName
            super();

            if( source != null && Util.isLogger(source) ){
                console.warn("source for the RealtimeFlow Channel - " + channel + " is a logger. Defaulting to IteratorFlow");
                source = Flow.from(source);
            }

            if( !(!source) && !(source instanceof Flow) )//check if source is a Flow
                throw new Error("Source is NOT a Flow");

            this.forwardConn = false;    //connection from this side to the other end
            this.backwardConn = false;  //connection from the other end to this side
            this.uid = Util.generateUUID();
            let self = this;

            let forward = io.of('/' + appName + "/" + app + "/" + channel);//  //create a namespace for the forward channel, with the varName.
            forward.on('connection', function(socket){
                //console.log('someone connected');
                self.backwardConn = true;
                socket.on("input", function(data){
                    if( data.uid === self.uid )
                        return;
                    if( callback )
                        callback(data.input, self);
                });
                socket.on('disconnect', function(){
                    self.backwardConn = false;
                })
            });

            this.forward = forward;
            //this.backward = backward;
            this.endApp = app;  //app on the socket end of the connection
            this.commChannel = channel;
            this.callback = callback;

            this.connectClient();


            this.source = source;
            if( source )
                setRefs(source, this);  //Create a link from the source flow to this flow so that we receive push data
            this.pipeFunc = (input) => input;   //Create a default function to regularize the Flow design
            this.transformer = (input) => input;    //This function will be used to transform the outflow data if required
            this.tracker = 1;   //value to make the entries unique
        }

        connectClient(){
            var self = this;
            //check if we have the port number for the app and that it is the app for the same level (e.g Fog->Fog)
            if( !runningApps[this.endApp] || runningApps[this.endApp].level !== level ){
                setTimeout(self.connectClient.bind(self), Math.ceil(PING_INTERVAL / 3));
                return;
            }

            //console.log("Other client is running on: ", runningApps[this.endApp].port);

            let clientIO = require('socket.io-client');
            let socket = clientIO.connect('http://localhost:' + runningApps[this.endApp].port + '/' + this.endApp + "/" + appName + "/" + this.commChannel);//
            this.clientSoc = socket;
            //console.log('/' + this.endApp + "/" + appName + "/" + this.commChannel);
            socket.on('connect', function(){
                self.forwardConn = true;
            });
            socket.on('disconnect', function(){
                self.forwardConn = false;
            });
            socket.on("input", function(data){
                if( data.uid === self.uid )
                    return;
                if( self.callback )
                    self.callback(data.input, self);
            });
        }

        /**
         * This tells if we can be able to send a message to the other end of the connection.
         * Messages could be sent/received from either socket.
         * @returns {boolean}
         */
        isConnected(){
            return this.forwardConn || this.backwardConn;
        }

        /**
         * This tells if both sockets are connected. Messages could be sent/received from either socket
         * @returns {boolean}
         */
        isFullyConnected(){
            return this.forwardConn && this.backwardConn;
        }

        push(input){
            this.send(input);
        }

        send(input, transform){
            if( transform === undefined || transform === null )
                transform = true;
            if( transform )
                input = this.transformer(input);    //transform input before sending off

            //Select a socket that is connected
            let comm = this.forward;
            if( this.forwardConn )
                comm = this.clientSoc;

            comm.emit("input", {uid: this.uid, input: input});
            this._sendToChannels(input);
        }
    }



    /**
     * *Still on development*
     * Multicore Flow data processing with ParallelFlow
     */
    class ParallelFlow extends IteratorFlow{
        constructor(iterator){
            super(iterator);

            this.iteratorFlow = null;   //the iterator flow generating the data
            this.isParallel = true;
            this.callTree = null;
            this.myJobID = 0;

            this.processor = null;
        }

        static from(data){
            return new ParallelFlow(Flow.from(data).iterators[0]);
        }

        static of(){
            var iteratorFlow;

            if( arguments.length == 0 )
                iteratorFlow = FlowFactory.getFlow([]);
            else if( arguments.length > 1 )
                iteratorFlow = FlowFactory.getFlow(arguments);
            else if( arguments.length == 1 && Util.isNumber(arguments[0]) )
                iteratorFlow = FlowFactory.createFlowWithEmptyArraysFromNumber(arguments[0]);
            else
                iteratorFlow = FlowFactory.getFlow(arguments[0]);

            return new ParallelFlow(iteratorFlow.iterators[0]);
        }

        static fromRange(start, end){
            return new ParallelFlow(Flow.fromRange(start, end).iterators[0]);
        }

        /**
         * This method specifies the number of cores to use for Flow operations in preparation for Parallel Flow.
         * @param cores the numbers of cores on the device to use
         */
        static useCores(cores){
            if( !cores || isNaN(parseInt(cores)) )
                cores = 1;

            ParallelFlow._cores = Math.min(require('os').cpus().length, cores);

            //Farm.init(ParallelFlow._cores);
        }

        static getUsedCores(){
            return ParallelFlow._cores;
        }

        static getTotalCores(){
            return Farm.totalCores;
        }

        _process(){
            return super.process();
        }

        process(callback){
            this.processor = new ParallelFlowProcessor(this, callback);
            this.processor.start();
        }

        //start parallel operations
        _startOps(callTree, jobType){
            this.callTree = callTree;

            //set the jobID for this ParallelFlow
            this.myJobID = ParallelFlow.jobID++;

            //trigger the setup processes
            Farm.broadcast({
                messageType: "setup",
                jobID: this.myJobID,
                job: "flow",
                jobType: jobType,
                structure: callTree
            });

            //subscribe for messages on this jobID
            Farm.subscribe(this.myJobID, this);
        }

        //stop parallel operations
        _stopOps(){
            //TODO kill the Job
        }

        //receive messages from worker
        notify(worker, message){
            this.processor.notify(worker, message);
        }

        static isReady(){
            return Farm.getTotalWorkersOnline() >= Farm.getTotalWorkers() && Farm.getTotalWorkers() > 0;
        }


        //**********************//
        // ParallelFlow Actions //
        //**********************//

        count(callback){
            if( !callback || !Util.isFunction(callback) )
                throw new Error("Callback function is needed for ParallelFlow actions.");

            var self = this;
            let callTree = this.buildCallTree();
            let tree = {
                type: "action",
                name: "count",
                prev: callTree
            };

            this.rootFlow._startOps(tree, "pipe");

            //we pass a callback to process...we can also pass other instructions to guide the processing
            this.process((bundles) => {
                //order the items by their orderID...depending on the Flow methods, we may not need this
                //bundles.sort((obj1, obj2) => obj1.orderID - obj2.orderID);  //TODO may not need this
                // filter out the outputs and concat with what we already have

                //We may not necessarily have to do this cause the user could reuse the same Flow action
                self.outputs = null;    //reset it for other processes

                callback(Flow.from(Flow.from(bundles).select(b => b.output).where(output => output != null).collect()).sum());
            });
        }

        groupBy(keyFunc, callback){
            if( !callback || !Util.isFunction(callback) )
                throw new Error("Callback function is needed for ParallelFlow actions.");

            var groupFunc = keyFunc;
            if( !Util.isFunction(keyFunc) ) {
                groupFunc = function (input) {
                    return input[keyFunc];
                };
            }

            var self = this;
            let callTree = this.buildCallTree();
            let tree = {
                type: "action",
                name: "groupBy",
                prev: callTree,
                func: groupFunc
            };

            this.rootFlow._startOps(tree, "pipe");

            this.process((bundles) => {
                //We may not necessarily have to do this cause the user could reuse the same Flow action
                self.outputs = null;    //reset it for other processes

                var groups = bundles[0];

                for(let i = 1; i < bundles.length; i++){
                    Flow.from(bundles[i]).foreach(pair => {
                        if( groups[pair.key] )
                            groups[pair.key] = groups[pair.key].concat(pair.value);
                        else
                            groups[pair.key] = pair.value;
                    });
                }

                callback(groups);
            });
        }

        collect(func, callback){
            if( !callback || !Util.isFunction(callback) )
                throw new Error("Callback function is needed for ParallelFlow actions.");

            var jobType, groupFunc = null;

            if( !func )
                jobType = "toArray";

            if( Util.isFunction(func) ) {
                if( func == Flow.toArray )
                    jobType = "toArray";
                else if( func == Flow.toSet )
                    jobType = "toSet";
                else {
                    //this has to be collecting to a map
                    jobType = "toMap";
                    groupFunc = func;
                }
            }
            else if( Util.isString(func) ){
                if( func.toLowerCase() == "toarray" )
                    jobType = "toArray";
                else if( func.toLowerCase() == "toset" )
                    jobType = "toSet";
                else{//collect to Map
                    groupFunc = function (input) {
                        return input[func];
                    };
                }
            }
            else
                jobType = "toArray";

            var self = this;
            let callTree = this.buildCallTree();
            let tree = {
                type: "action",
                name: jobType,
                prev: callTree,
                func: groupFunc
            };

            this.rootFlow._startOps(tree, "pipe");

            this.process((bundles) => {
                //We may not necessarily have to do this cause the user could reuse the same Flow action
                self.outputs = null;    //reset it for other processes

                if( jobType == "toArray" ){
                    var array = bundles[0];

                    for (let i = 1; i < bundles.length; i++)
                        array = array.concat(bundles[i]);

                    callback(array);
                }
                else if( jobType == "toSet" ){
                    var set = bundles[0];

                    for(let i = 1; i < bundles.length; i++){
                        for(let item of bundles[i].values())
                            set.add(item);
                    }

                    callback(set);
                }
                else {//toMap
                    var map = bundles[0];

                    for (let i = 1; i < bundles.length; i++) {
                        Flow.from(bundles[i]).foreach(pair => {
                            if (map.has(pair.key))
                                map.set(pair.key, map.get(pair.key).concat(pair.value));
                            else
                                map.set(pair.key, pair.value);
                        });
                    }

                    callback(map);
                }
            });
        }
    }

    //Do static declarations for ParallelFlow
    ParallelFlow._cores = 1; //The number of cores to use for pFlow processing.
    ParallelFlow.jobID = 1; //start from 1. Jobs will increase this as they are generated


    /**
     * This class is solely responsible for doing parallel processing processes for ParallelFlow
     */
    class ParallelFlowProcessor{
        constructor(pFlow, callback){
            this.pFlow = pFlow;
            this.callback = callback;

            this.outputs = null;  //the outputs from the operations
            this.responses = {};    //The responses from the
            this.promises = {};

            this.uniqueID = 1;
            this.taskID = 0;    //The task ID within this job...tasks could be sent and response received and further tasks sent

            this.tasks = {};
            this.taskPos = 0;

            this.hasAction = false;
        }

        /**
         * This method examines the call tree and break the job into tasks
         * Then calls beginTask to start operating on the tasks one after the other
         */
        start(){
            var callTree = this.pFlow.callTree;
            var treeStack = [];

            while( callTree != null ){
                treeStack.push(callTree);
                callTree = callTree.prev;
            }

            this.hasAction = treeStack[0].type == "action";

            var levelTask = null;
            var taskGroup;
            var taskID;
            do{
                taskGroup = [];
                taskID = this.taskID++;

                while( treeStack.length > 0 ){
                    levelTask = treeStack.pop();
                    if( taskable(levelTask) ){
                        if( taskGroup.length > 0 ){ //if we have added items already then we form a task from them first
                            this.tasks[taskID + ""] = taskGroup.slice();
                            taskGroup = [];
                            taskID = this.taskID++;
                        }

                        taskGroup.push(levelTask);
                        this.tasks[taskID + ""] = taskGroup.slice();

                        break;
                    }
                    else
                        taskGroup.push(levelTask);
                }
            }while( treeStack.length > 0 );

            this.beginTask();
        }

        beginTask(){
            if( !this.tasks["" + this.taskPos] ){//all tasks have been completed
                this.callback();    //TODO send the final data to the callback
                return;
            }

            var order = 1;  //this is the order id in a task
            var isDone = false;
            var totalResponses = 0;
            var totalWorkSent = 0;
            var promises = [], promise;
            var task = this.tasks["" + this.taskPos++];
            var taskID = self.taskID++;

            if (Farm.getTotalWorkers() == 0)
                throw new Error("Workers could not be started!");

            do {
                for (let i = 0; i < Farm.getTotalWorkers(); i++) {
                    //generate data from the iterator and send
                    var data = self._process();

                    if (data == null) {
                        isDone = true;
                        break;
                    }

                    totalWorkSent++;

                    const bundle = {
                        messageType: "task",
                        jobID: self.myJobID,
                        taskID: taskID,
                        orderID: order++,
                        uniqueID: uniqueID++,
                        input: data
                    };

                    promises.push(new Promise((resolve) => {
                        self.promises[bundle.uniqueID + ""] = resolve;
                        Farm.send(bundle);
                    }));
                }
            }while( !isDone );

            promise = Promise.all(promises);

            promise.then((bundles) => {
                totalResponses += bundles.length;
                callback(bundles);
            });
        }

        notify(worker, message){
            (this.promises[message.uniqueID + ""])(message);
            delete this.promises[message.uniqueID + ""];
        }
    }

    //if this item could be a task on its own
    function taskable(levelTree){
        return levelTree.type == "action" || Util.isIn(levelTree.name, ["skip", "limit", "range"]);
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
            return new IteratorFlow((function(_array){
                var array = _array;
                var index = 0;

                return {
                    next: function(){
                        try {
                            return index < array.length ? {value: array[index], done: false} : {done: true};
                        }
                        finally{
                            index++;
                            if( index > array.length )  //after returning done, reset the iterator
                                index = 0;
                        }
                    }
                };
            })(array));
        }

        /**
         *
         * @param number the number of items to create
         */
        static createFlowWithEmptyArraysFromNumber(number){
            //create empty arrays of count number
            number = Math.ceil(number); //just in case it is not an integer

            var array = [];

            while( number-- )
                array.push([]);

            return FlowFactory.createFlowFromArray(array);
        }

        /**
         *
         * @param map Javascript Map object
         */
        static createFlowFromMap(map){
            return new IteratorFlow((function(_map){
                var map = _map;
                var entries = map.entries();

                return {
                    next: function(){
                        var entry = entries.next();
                        if( entry.done ) {
                            entries = map.entries();    //reset the map entries iterator just before returning done
                            return entry;
                        }
                        else
                            return {value: {key: entry.value[0], value: entry.value[1]}, done: false};
                    }
                };
            })(map));
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
            //TODO save state for restarting when Flow is being reused
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
                            if( pos > length )  //reset the position to start after the last value is returned
                                pos = 0;
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
                if( path.trim().substring(0, "fs://".length) == "fs://" )
                    path = path.trim().substring("fs://".length);

                var lineByLine = require('n-readlines');
                var liner = new lineByLine(path);

                return {
                    next: function(){
                        var line = liner.next();

                        if( line )
                            return {value: line.toString("utf8"), done: false};

                        liner = new lineByLine(path);   //reset the line reader itertor just before returning done

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
                        try {
                            length = streams.size(); //Update the length in case a new device has been added    //TODO may be removed
                            return pos < length ? {value: streams[pos], done: false} : {done: true};
                        }
                        finally{
                            pos++;
                            if( pos > length )  //reset the position after the last item (if we will ever get to one)
                                pos = 0;
                        }
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
            return new IteratorFlow((function(){
                var pos = 0;
                var stream = dataStream;

                return {
                    next: function(){
                        try {
                            return pos < stream.size() ? {
                                value: stream.get_value_at(pos++),
                                done: false
                            } : {done: true};
                        }
                        finally{
                            pos++;
                            if( pos > stream.size() )  //reset the position after the last item (if we will ever get to one)
                                pos = 0;
                        }
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
                            used = !used;
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
            return Object.prototype.toString.call(obj) === '[object Array]';
        },
        isLikeArray: function(obj){
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
        },

        //Used to build subscription key for Apps that subscribe with Objects
        buildKey: function(obj){
            var key = 'aps[' + obj.app + ']';
            if( obj.namespace )
                key = key + '.ns[' + obj.namespace + ']';
            if( obj.flow )  //for OutFlow and InFlow
                key = key + '.flow[' + obj.flow + ']';
            if( obj.datasource )
                key = key + '.ds[' + obj.datasource + ']';
            if( obj.datastream )
                key = key + '.dts[' + obj.datastream + ']';

            return key;
        },

        //Used to rebuild subscription key back to Objects
        buildKeyObject: function(key){
            var obj = {}, content;

            var parts = key.split(".");

            for( let part of parts ){
                content = part.substring(part.indexOf("[") + 1, part.indexOf("]"));

                if( part.startsWith("aps") )
                    obj.app = content;
                else if( part.startsWith("ns") )
                    obj.namespace = content;
                else if( part.startsWith("flow") )
                    obj.flow = content;
                else if( part.startsWith("ds") )
                    obj.datasource = content;
                else if( part.startsWith("dts") )
                    obj.datastream = content;
            }

            return obj;
        },
        generateUUID: function(){ //Obtained from: https://stackoverflow.com/a/8809472/8326992
            let d = new Date().getTime();
            if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
                d += performance.now(); //use high-precision timer if available
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                let r = (d + Math.random() * 16) % 16 | 0;
                d = Math.floor(d / 16);
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        }
    };

    Flow.version = require('./package.json').version;

    return {
        Flow: Flow,
        InFlow: InFlow,
        OutFlow: OutFlow,
        ParallelFlow: ParallelFlow,
        PFlow: ParallelFlow,
        RealtimeFlow: RealtimeFlow
    };
};
