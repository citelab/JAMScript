jcond {
		tagAOnly: jsys.tag == "tagA";
		fogOnly: jsys.type == "fog";
}
​
jtask* {fogOnly} function you(str) {
    console.log("Received.. ", str);
}
