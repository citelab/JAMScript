
jcond {
    fogonly: jsys.type == "fog";
    typeAonly: jsys.tag == "typeA";
}

let count = 10;

jtask {fogonly} function compyou(str) {
    count++;
    console.log("Compyou running.... ",  count, str);
    let qq = count * count;
    //let waitTill = new Date(new Date().getTime() + 50);
    //while(waitTill > new Date()){}
    console.log("Value I am returning..... to the other side == ", qq);
    return qq;
}

let long = jsys.long;
let lat = jsys.lat;

setInterval(()=> {
    count++;
//    console.log("Tag..... ", jsys.tags);
//    if (jsys.type === 'device') {
//        long = (long + 5) % 170;
//        jsys.setLoc({long: long, lat: lat});
//        console.log("Longitude and Latitude .... ", jsys.long, jsys.lat);
//    }
//    console.log("Calling compyou.. ");
//    let x = compyou(" String = " + count++); // --> let x = jworklib.machExecuteRV("compyou", ...)
//    x.then((y)=> {console.log(y.status(), y.values())}).catch(()=> {console.log("Helllo.....");});

    if (jsys.type === "fog") {
        console.log("Calling get value...for ", count);
        let x = get_a_value(count);
        x.then((y)=> { console.log("results ..... of the call ", y.values())});
    }
}, 1000);


