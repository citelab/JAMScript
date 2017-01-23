var JLogger = require('/usr/local/share/jam/lib/jserver/jlogger');
var JManager = require('/usr/local/share/jam/lib/jserver/jmanager');

jdata{
    int stuff as broadcaster;
}

setTimeout(
    function(){
        console.log("Sending Stuff");
        JManager.broadcastMessage('DEFAULT_APP' , 5);
    }, 15000);