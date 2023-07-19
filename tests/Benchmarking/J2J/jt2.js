var counter = 0;

jtask* function remoteCall(test) {
  counter += 1;
}


setInterval(() => {
  console.log("Counter: " + counter);
  counter = 0;
}, 1000);

