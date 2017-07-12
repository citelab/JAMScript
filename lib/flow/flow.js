/**
 * Created by Richboy on 02/06/17.
 */
/**
 * Created by Richboy on 30/05/17.
 */

"use strict";

var Manager = require('jamserver')(true).JAMManager;
var Queue = require('./Queue.js');

(function(){
    class Flow{
        constructor() {
            this.prev = null;    //The parent of this Flow
            this.next = null;    //The children of this Flow
            this.pipeFunc = (output) => output;    //The Pipe function to execute for this Flow
            this.rootFlow = null;   //The First Flow...to be used for push operations (Can be used for InFlow/OutFlow)
            this.terminalFunc = (output) => {}; //This is the Flow terminal function for a push operation. It is mostly for the last created Flow in the Flow chain.
            this.isDiscretized = false;

            Flow._cores = 1; //The number of cores to use for pFlow processing.

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

            var obj = this.prev.process();
            if(obj == null)
                this._addElement(null);

            return obj;
        }

        startPush(){
            this.prev.startPush();
        }

        stopPush(){
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
         * This method specifies the number of cores to use for Flow operations in preparation for Parallel Flow.
         * @param cores the numbers of cores on the device to use
         */
        static useCores(cores){
            if( !cores || isNaN(parseInt(cores)) )
                cores = 1;

            Flow._cores = Math.min(require('os').cpus().length, cores);
        }

        static getUsedCores(){
            return Flow._cores;
        }


        buildCallTree(){
            //TODO this method is supposed to build the call tree stack of this Flow from the IteratorFlow. Under investigation
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
            var flow = new Flow();
            flow.pipeFunc = func;

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

        orderBy(){

        }

        groupBy(){

        }

        //*May not be necessary
        join(){

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
            var data, _next;
            _next = this.next;
            this.next = null;

            while( (data = this.process()) != null )
                func(data);

            this.next = _next;
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

            return sum / count;
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
            this.isDataEndObject = {isDataEnd: (data) => false};   //A object that implements the isDataEnd The function to check if we have gotten to the end of a discrete stream
            this.recall = {};   //any variable that needs to be remembered will plug in here.
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
                    throw "Datastreams/Datasources cannot be merged with other data types";

                this.iterators.push(iterator);
            }

            return this;
        }

        startPush(){
            if( this.isListening )
                return;

            this.isListening = true;

            if( this.iterators[0].logger || this.iterators[0].stream )  //if this is a datastream/logger
                this._listen();
            else
                this._doPush();
        }

        stopPush(){
            if( !this.isListening )
                return;

            this.isListening = false;

            if( this.iterators[0].logger || this.iterators[0].stream ){ //if this is a datastream/logger
                for( let iterator of this.iterators ){
                    if( iterator.logger ){//if this iterator was a datasource/logger
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
        _doPush(){//This works best for OutFlow from filesystem (since it is static/finite) and JS generators too...
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
            var streams = [];   //the order with which we should arrange data in discretized flows

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

            //set up the basics for a discretized push
            //this.recall.streams = streams;  //save the order in recall
            this.recall.streamKeys = Flow.from(streams).select((stream) => stream.key).collect(Flow.toArray);
            this.recall.queues = Flow.from(streams).select((stream) => new Queue()).collect(Flow.toArray);
            this.discreteStreamLength = Math.min(streams.length, this.discreteStreamLength);    //ensure minimum
            this.recall.ready = true;   //a flag that ensures we do not have more than one setTimeout function in queue
            this.recall.called = false; //if we have called the setTimeout function at least once
            this.streamElements = [];
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
        }

        /**
         * This method makes the IteratorFlow discretizable.
         * @param span The number of streams/iterators to look at in the window.
         *      'streams' value of 1 means that we focus on only one stream for the window size and move to the next stream.
         *      'streams' value greater than 1 means that we should do a round-robin based on the specified number
         *          and then move to the next stream(s) and do the same, operating on the data based on the specified length
         * @param spanLength The window length. The length of data to be treated as one (a block).
         *      The length could be a function that determines when we have gotten to the last item.
         *      This could be used for custom time-based discretization. So data could be split based on time.
         * @param spawnFlows if we should spawn DiscreteFlows as output
         */
        discretize(span, spanLength, spawnFlows){
            if( spawnFlows === undefined )
                spawnFlows = true;

            this.discreteStreamLength = span;
            this.isDataEndObject = getDataEndObject(spanLength);
            this.isDiscretized = true;

            var flow = new DiscretizerFlow(span, this.isDataEndObject, spawnFlows);
            setRefs(this, flow);

            return flow;
        }
    }

    /**
     * This method subscribes a Flow (IteratorFlow) to a datastream to listen for data changes
     * This method is placed outside the class to prevent external access
     * @param stream the datastream to subscribe to
     * @param flow the IteratorFlow object which will initiate the push
     */
    function subscribeToStream(stream, flow){
        var func = function(key, entry){
            var obj = {
                key: Manager.buildKeyObject(key),
                data: entry.log,
                timestamp: entry.time_stamp
            };
            setTimeout(() => {flow._prePush(obj, stream);}, 0);
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
            obj = (function(length){
                return {
                    isDataEnd: length
                };
            })(spanLength);
        }
        else if( spanLength.isDataEnd && Util.isFunction(spanLength.isDataEnd) )
            obj = spanLength;
        else
            throw "Span length can be either a Number, a function or an object with an 'isDataEnd' function";

        return obj;
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

                this._addElement(input);

                if (this.next !== null)
                    return this.next.pipe(input);
                else
                    return input;
            }
            else {
                this._addElement(null);
                return null;
            }
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
        }
    }

    /**
     * The job of this class is to create DiscretizedFlows
     */
    class DiscretizerFlow extends Flow{
        constructor(span, isDataEndObject, spawnFlows){
            super();
            this.span = span > 0 ? span : 1;
            this.isDataEndObject = isDataEndObject; //the object with the function that allows us to determine if we have gotten to the end of a window
            this.spawnFlows = spawnFlows;
            this.elements = [];  //this are saved data which are used to create a Discretized Flow
        }

        process(){
            return this.prev.process();
        }

        pipe(input){
            if( this.prev instanceof IteratorFlow ) //Don't do any more work...it has been discretized from IteratorFlow
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
                                toAdd.add(null);
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
            if( this.prev instanceof IteratorFlow ) //Don't do any more work...it has been discretized from IteratorFlow
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
                                toAdd.add(null);
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

        start(){
            this.rootFlow.startPush();
        }

        stop(){
            this.rootFlow.stopPush();
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
                path = path.substring("fs://".length);

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
                            if( pos > length )  //reset the position after the last item (if we will ever get to one)
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