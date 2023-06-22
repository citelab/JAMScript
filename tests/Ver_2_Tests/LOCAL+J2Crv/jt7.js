jdata {
    int enable_task as uflow;
}

jcond {
    jcond_enable_task: enable_task == 1;
}

let count = 10;

setInterval(()=> {
    if (jsys.type === 'fog')
	    get_a_value(count++).then((y)=> {
            console.log("Return value from the call...", y.values());
	    }).catch(()=> {
	        console.log("Error...");
	    });
}, 100);
setInterval(()=> {
    if (jsys.type === 'fog')
	    toggle_jcond().then((y)=> {
            console.log("Jcond set to...", y.values());
	    }).catch(()=> {
	        console.log("Error toggling...");
	    });
}, 1000);
