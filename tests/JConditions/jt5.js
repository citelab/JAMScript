let count = 0;

jcond {
    fogonly(my, your) {
        return my.type === 'fog';
    }
    devonly(my, your) {
        return my.type === 'device';
    }
}

jsync char[60] {fogonly} compyou1(str: char*) {
    count++;
    console.log("at fog.. ", count, str);
    return "from fog: hello -- " + count + " " + str;
}

jsync char[60] {devonly} compyou2(str: char*) {
    count++;
    console.log("at dev... ", count, str);
    return "from dev: hello -- " + count + " " + str;
}


setInterval(()=> {
    //console.log("hello.. main loop ");
}, 1000);
