
let count = 0;

jreuse {
    test(olds, news) {
        console.log("reusing", count);
        return count === 3;
    }
}


jsync char[60] [reuse = test, reuse_history = 3] compyou(str: char*) {
    count++;
    console.log(count, str);
    return "hello -- " + count + " " + str;
}

setInterval(()=> {
    console.log("hello.. main loop ");
}, 1000);
