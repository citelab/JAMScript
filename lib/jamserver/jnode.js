//===================================================================
// This is the main processor for J nodes.
// All types of processing are done here.
//===================================================================


const JAMCore = require('./jamcore');
const deasync = require('deasync');

module.exports = new function() {

    this.init = function (reg, mtype) {
        this.jcore = new JAMCore(reg, mtype);
        this.jadmin = this.jcore.jadmin;
        this.jclient = this.jcore.jclient;
        this.jdaemon = this.jcore.jdaemon;

        this.run = this.jcore.run;

        this.registerCallback = this.jcore.registerCallback.bind(this.jcore);
        this.remoteSyncExec = deasync(this.jclient.remoteSyncExec.bind(this.jclient));
        this.remoteAsyncExec = this.jclient.remoteAsyncExec.bind(this.jclient);
        this.machAsyncExec = this.jclient.machAsyncExec.bind(this.jclient);
        this.machSyncExec = deasync(this.jclient.machSyncExec.bind(this.jclient));
        this.jcondContext = this.jcore.jcondContext;
        this.poplevel = this.jcore.popLevel.bind(this.jcore);
        this.addBroadcaster = this.jcore.addBroadcaster.bind(this.jcore);
        this.addLogger = this.jcore.addLogger.bind(this.jcore);
        this.addFlow = this.jcore.addFlow.bind(this.jcore);
        this.setjcond = this.jcore.setjcond.bind(this.jcore);
        this.ncache = this.jcore.ncache;
    }

    this.getcore = function() {
        return this.jcore;
    }
}
