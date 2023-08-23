
jcond {
    fogonly: jsys.type == 'fog';
    cloudonly: jsys.type == 'cloud';
}

let count = 10;

jtask {fogonly} function compXAB(str) {
    console.log("Calling XAB with ...", str);
    resolve(count++);
}


jtask {cloudonly} function compYCD(str) {
    console.log("Calling YCD with .. ", str);
    resolve(count++);
}

if (jsys.type === 'device') {

    setInterval(()=> {
	    console.log("Hi.... ");
	    compXAB("this is a message from the device");
    }, 1000);
} else if (jsys.type === 'fog') {

    setInterval(()=> {
	    console.log("Hi.... ");
	    compYCD("this is a message from the fog");
    }, 1000);
}
