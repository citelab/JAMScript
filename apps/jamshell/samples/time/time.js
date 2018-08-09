var now = Date.now().toString();

jdata {
  char* timestamps as logger;
}

var myDataStream = timestamps.getMyDataStream();
setInterval(function() {
  myDataStream.log(now);
}, 1000);

if (jsys.type == 'cloud') {
  var config = require('./config/default');
  var totalDataStreams = 1 + config.fogs + config.devices;
  var timeout = setInterval(function() {
    var numDataStreams = timestamps.size();
    log_msg('totalDataStreams=' + totalDataStreams + ', numDataStreams=' + numDataStreams);
    if (numDataStreams == totalDataStreams) {
      var maxTimestamp = 0;
      for (var i = 0; i < numDataStreams; i++) {
        var lastValue = timestamps[i].lastValue();
        if (lastValue != null && lastValue > maxTimestamp) {
          maxTimestamp = lastValue;
        }
      }
      log_msg(maxTimestamp.toString());
      clearInterval(timeout);
    }
  }, 2500);
}
