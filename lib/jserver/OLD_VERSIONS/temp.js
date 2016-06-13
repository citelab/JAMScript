var nano = require('nanomsg'),
    cbor = require('cbor');

var REPLY_URL = 'tcp://*:5555',
	PUBLISH_DEVS_URL = 'tcp://*:6666',
	PUBLISH_CLDS_URL = 'tcp://*:6677',
	SURVEY_DEVS_URL = 'tcp://*:7777',
	SURVEY_CLDS_URL = 'tcp://*:7788';

startReqService(8101, function(err) {
    console.log("Started the service...");

})


function startReqService(port, callback) {

	var sock = nano.socket('rep');
//	var url = "tcp://127.0.0.1:" + (port + 100);
    var url = "tcp://127.0.0.1:5565";
	console.log("Bind URL " + url);
	sock.bind(url);

	sock.on('data', function(buf) {
		console.log("In new service.. Buffer size " + Buffer.byteLength(buf));
		cbor.decodeFirst(buf, function(error, msg) {
			console.log(msg);
			if (msg["cmd"] == "PING") {
				msg["cmd"] = "PONG";
				var encode = cbor.encode(msg);
				sock.send(encode);

			}

		});
	});

	console.log("Started the service...at:" + url);
	callback(null);
}


//==========================================================
// SURVEY PROCESSING SECTION
// This is meant to process the survey messages
//==========================================================

var surveydevs = nano.socket('surveyor');
surveydevs.bind(SURVEY_DEVS_URL);

doSurveyOnDevices();

surveydevs.on('data', function(buf) {

});


function doSurveyOnDevices() {

};


var surveyclouds = nano.socket('surveyor');
surveyclouds.bind(SURVEY_CLDS_URL);

doSurveyOnClouds();

surveyclouds.on('data', function(buf) {

});


function doSurveyOnClouds() {

};


//==========================================================
// PUBLISH PROCESSING SECTION
// This is meant to process the publish messages
//==========================================================

var publishdevs = nano.socket('pub');
publishdevs.bind(PUBLISH_DEVS_URL);

doPublishOnDevices();

publishdevs.on('data', function(buf) {

});

function doPublishOnDevices() {

};


var publishclouds = nano.socket('pub');
publishclouds.bind(PUBLISH_CLDS_URL);

doPublishOnClouds();

publishclouds.on('data', function(buf) {

});


function doPublishOnClouds() {

};
