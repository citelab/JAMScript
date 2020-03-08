const Worker = require('tiny-worker');
const jmachlib = require('jamserver/jmachlib');
const JAMManager = require('jamserver/jammanager');
const JAMLogger = require('jamserver/jamlogger');
const JAMBroadcaster = require('jamserver/jambroadcaster');
var jsys;
var jman;
var jbcast;
var jlog;
function learncback() {
	jsys = jmachlib.getjsys();
	jman = new JAMManager(jmachlib.getcmdopts(), jsys);
	jbcast = new JAMBroadcaster('__nn_model', jman);
	jlog = new JAMLogger(jman, '__nn_data');
	jmachlib.loop(jman, jbcast, jlog);
}
jmachlib.run(function() { learncback(); });

