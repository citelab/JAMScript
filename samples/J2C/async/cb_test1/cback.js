function q(m) {
   console.log("Message from C", m);
}

var count = 0;
jsync function getid() {
   return ++count;
}


setInterval(()=> {

   console.log("Sending...");
   testcback("Message at JavaScript side", q);
}, 1000);

