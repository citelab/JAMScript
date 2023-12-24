let count = 0;

jcond {
    fogonly(my, your) {
        return my.type === 'fog';
    }
}

jsync char[60] {fogonly} compyou(str: char*) {
    count++;
    console.log(count, str);
    return "hello -- " + count + " " + str;
}

setInterval(()=> {
    //console.log("hello.. main loop ");
}, 1000);
