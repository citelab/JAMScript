
jcond {
    typeAonly: jsys.tag == "typeA";
    typeBonly: jsys.tag == "typeB";
}

setInterval(()=> {
    console.log("This is a loop at the controller.", jsys.tags);
    workerFuncX("hello, from controller").catch((e)=>{
        console.log("calling workerFuncX has an Error: " + e);
    });
    workerFuncY("hello, from controller").catch((e)=>{
        console.log("calling workerFuncY has an Error: " + e);
    });

}, 1000);