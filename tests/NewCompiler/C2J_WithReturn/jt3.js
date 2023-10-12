let count = 0;

jreuse {
    test(olds, news) {
        return olds.arg_0 == news.arg_0;
    }
}

jsync char[60] [reuse = test, reuse_history = 3] compyou(str: char*) {
    count++;
    console.log(count, str);
    return "hello -- " + count + " " + str;
}

setInterval(()=> {
    //console.log("hello.. main loop ");
}, 1000);
