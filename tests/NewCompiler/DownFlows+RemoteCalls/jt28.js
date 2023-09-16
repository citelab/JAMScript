jdata {
    struct __zz {
	    int x;
	    char u[30];
	    double yy;
    } qq as dflow;
}

let count = 0;

let names = ["jon", "benson", "muddin3", "ethan", "george"];

jasync remote_task(x: int, s: char*) {

    let values = {x: count, yy: 5.67 + count / 47, u: "hello " + names[count % names.length]};
    console.log("Writing to dflow -- ", values);
    qq.write(values);
    count += 1;
}

