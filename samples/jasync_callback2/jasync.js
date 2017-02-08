function callb(abc) {
   console.log(abc); 
}

jasync function firstcall(str) {
    console.log(str);
    testy(callb);
}
