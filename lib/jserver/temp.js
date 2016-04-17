
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
