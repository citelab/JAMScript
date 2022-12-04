
jcond {
    fogonly: jsys.type == "fog";
    typeAonly: jsys.tag == "typeA";
}

let count = 10;

jtask {fogonly} function compyou(str) {
    count++;
    console.log("Compyou running.... ",  count, str);
    let qq = count * count;
    console.log("Value I am returning..... to the other side == ", qq);
    return qq;
}

setInterval(()=> {
    console.log("Calling compyou.. ");
    let x = compyou(" String = " + count++); // --> let x = jworklib.machExecuteRV("compyou", ...)
    x.then((y)=> {
        console.log("Return value ", y);
    });
}, 3000);


