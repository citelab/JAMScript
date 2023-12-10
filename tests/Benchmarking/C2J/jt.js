var counter = 0;

jasync remoteCall(test: int) {
  counter += 1;
}

setInterval(() => {
  console.log("Counter: " + counter);
  counter = 0;
}, 1000);
