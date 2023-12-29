let count = 10;

while(1) {
    await jsys.sleep(1000);
    console.log("Hello... calling the C side... ");
    testfunc(count++).catch((e) => {
        console.log("Error in calling testfunc ", e);
    });
}
