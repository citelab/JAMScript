japp nspc {
    required_linker_flags:-lm, -lc;
    required_clibs: float.h, wchar.h, bazinga.h
}

let count = 0;

jasync you(str: char*) {
    count++;
    console.log("Message received: ", str, " local count ", count);
}

setInterval(()=> {
    console.log("                                              hello.. main loop ");
}, 2000);
