/**
 * Created by Richboy on 14/07/17.
 */
"use strict";

jdata{
    r as inflow of app://app1.p;
}

r.setTerminalFunction(receive); //we can chain r through other flow methods before setting the terminal function

function receive(data){
   console.log(data);
}