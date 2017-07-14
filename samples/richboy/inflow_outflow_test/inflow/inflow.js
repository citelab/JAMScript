/**
 * Created by Richboy on 14/07/17.
 */
"use strict";

jdata{
    r as inflow of app://app1.p;
}

r.setTerminalFunction(receive); //we can chain r through other flow methods before setting the terminal function

function receive(entry){
    //we could do a broadcast to all devices if we need to...
    console.log("Data: " + entry.data + ", Timestamp: " + entry.timestamp);
}