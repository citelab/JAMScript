
var count = 1;
function f() {
    var v = j2c_sync(jsys.id);
    console.log('J2C sync returned:', v.device);
    setTimeout(f, 30);
}

if (jsys.type === "fog") {
    setTimeout(f, 100);
}


//setInterval(function() {
//    testf(count++);
//}, 500);
