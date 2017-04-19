
function t() {
function test2(msg) {
    console.log("Test2..");
    console.log(msg);
}


function test3(msg) {
    console.log("Test 3...");
    console.log(msg);
}

function qq (msg) {
    console.log("Printing from qq : ", msg);
}

ob = {func: qq}
gg = ["what is up?", "nothing much", "hello, what is time?"];

test2("hello");
test3("world");
ob.func.apply(this, gg);

test2("hello 2");
test3("world 2");


}

t();