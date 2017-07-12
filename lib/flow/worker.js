/**
 * Created by Richboy on 04/07/17.
 */

"use strict";

var JSONfn = require('json-fn');
var Flow = require('./flow.js').Flow;
const SETUP = "setup";
const TERMINATE = "terminate";
const DEBUG = false;

/**
 * This class provides all the necessary information about the worker and the jobs to handle
 * For lack of Singleton in JS, we create a single instance which will be responsible for all the needful
 */
class FlowWorker{
    constructor(cluster){
        this.cluster = cluster;
        this.jobs = {};    //The jobs that this worker will work on...each job can have multiple tasks
    }

    getWorkerID(){
        return this.cluster.worker.id;
    }

    getWorkerPID(){
        return this.cluster.worker.process.pid;
    }

    dispatch(message){
        if( !message.jobID ){
            console.log("Message must have a jobID parameter. #" + this.getWorkerID());
            return;
        }

        if( message.messageType == SETUP ){
            if( message.job == "flow" )
                this.addJob(new FlowJob(message, this), message.jobID);
            else
                this.addJob(new Job(message, this), message.jobID);
        }
        else if( message.messageType == TERMINATE )
            this.jobs[message.jobID].terminate();
        else{
            if( this.jobs[message.jobID] )
                this.jobs[message.jobID].process(message);
            else
                console.log("No Job with ID: " + message.jobID + " exists! - #" + this.getWorkerID());
        }
    }

    addJob(job, jobID){
        this.jobs[jobID] = job;
    }

    removeJob(job){
        delete this.jobs[job.jobID];
    }
}

/**
 * A Job has several tasks to perform within it
 */
class Job{
    constructor(setup, worker){
        this.tasks = {};    //the different tasks be worked on
        this.worker = worker;   //The FlowWorker object
        this.jobID = setup.jobID;   //The Job ID identifying this Parallel Job
        this.structure = setup.structure;   //The JSON structure (for the Flow chain)
        this.jobType = setup.jobType;   //Push or Pipe (for Flow)

        if( DEBUG )
            console.log("New Job Created:" + this.jobID + " on Worker #" + worker.getWorkerID() + " on Process #" + worker.getWorkerPID());
    }

    terminate(){
        this.tasks = {};
        this.worker.removeJob(this);
    }

    process(message){
    }
}

/**
 * This class is responsible for handling Parallel Flow jobs
 */
class FlowJob extends Job{
    constructor(setup, worker){
        super(setup, worker);

        //build the Flow chain from the structure
        var build = Flow.buildFromCallTree(setup.structure);
        this.flow = build.flow;

        if( this.flow.rootFlow != null )    //we have a flow chain
            this.flow.rootFlow.shouldCache = false;
        else    //this is the iterator flow
            this.flow.shouldCache = false;

        this.action = build.action;

        //Temporary storage for part processes.
        this.tempObject = null
    }

    process(message){
        if( message.messageType == "task" )
            this._doTask(message);
        else if( message.messageType == "finishTask" )
            this._finishTask(message);
    }

    _doTask(bundle){
        if( this.flow.rootFlow != null )    //we have a flow chain
            this.flow.rootFlow.iterators = Flow.from([bundle.input]).iterators;
        else    //this is the iterator flow
            this.flow.iterators = Flow.from([bundle.input]).iterators;

        bundle.messageType = "response";
        bundle.id = this.worker.getWorkerID();
        bundle.pid = this.worker.getWorkerPID();
        delete bundle.input;

        //add this task to the task list for when we receive the finish task command
        if (!this.tasks["" + bundle.taskID])
            this.tasks["" + bundle.taskID] = bundle;

        var outputs = [], data;

        if( this.jobType == "pipe" ) {//we will always have an action cause that is what triggers the start operation
            if (this.action != null) {
                var group;

                switch (this.action.name) {
                    case "count":
                        if( this.tempObject == null )
                            this.tempObject = 0;

                        while ((data = this.flow.process()) != null) {
                            outputs.push(data);
                        }

                        this.tempObject += outputs.length;
                        return;

                    case "groupBy":
                        if( this.tempObject == null )
                            this.tempObject = {};

                        while( (data = this.process()) != null ){
                            group = this.structure.func(data);
                            if( !this.tempObject[group] )
                                this.tempObject[group] = [];

                            this.tempObject[group].push(data);
                        }
                        return;

                    case "toArray":
                        if( this.tempObject == null )
                            this.tempObject = [];

                        while ((data = this.flow.process()) != null) {
                            this.tempObject.push(data);
                        }
                        return;

                    case "toSet":
                        if( this.tempObject == null )
                            this.tempObject = new Set();

                        while ((data = this.flow.process()) != null) {
                            this.tempObject.add(data);
                        }
                        return;

                    case "toMap":
                        if( this.tempObject == null )
                            this.tempObject = new Map();

                        while ((data = this.flow.process()) != null) {
                            group = this.structure.func(data);
                            if( !this.tempObject.has(group) )
                                this.tempObject.set(group, []);

                            this.tempObject.set(group, this.tempObject.get(group).push(data));
                        }
                        return;
                }
            }
            else {

            }
        }
        else{//push
            //TODO no action...could be to Flow or to terminal function...here we send message after each processing
            while ((data = this.flow.process()) != null) {
                outputs.push(data);
            }

            bundle.output = outputs.length == 1 ? outputs[0] : outputs.length > 1 ? outputs : null;
            process.send(bundle);
        }
    }

    //this should only be used for pipe job types
    _finishTask(bundle){
        switch (this.action.name) {
            case "count":
                this.tasks["" + bundle.taskID].output = this.tempValue;
                break;
            case "groupBy":
                this.tasks["" + bundle.taskID].output = this.tempObject;
                break;
        }

        process.send(this.tasks["" + bundle.taskID]);
    }

    _houseKeeping(){
        this.tempObject = null;
    }
}


var worker = new FlowWorker(require('cluster'));
process.on("message", function(message){
    worker.dispatch(Object.prototype.toString.call(message) === '[object String]' ? JSONfn.parse(message) : message);
});