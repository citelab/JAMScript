var num_calls = 0;

jasync function ping_asyn(msg){
    if(msg != "PING")
        console.log("DAMMIT ROBERT ON JAVSCRIPT");
    num_calls++;
}

jsync function get_num_ping(){
    return num_calls;
}