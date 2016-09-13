var iterations = 100;
for(var i = 0; i < iterations; i++){
    ping_async("PING", 100);
}

jasync function get_rcv_count(num){
    if(num != iterations)
        console.log("DAMMIT ROBERT ON JAVSCRIPT");
}