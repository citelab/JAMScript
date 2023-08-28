const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function interactive_mode() {
  rl.question("(f/F/r/R) ", function (answer) {
    switch(answer) {
    case "f":
      go_forward(5);
      break;
    case "F":
      go_forward(10);
      break;
    case "b":
      go_backward(5);
      break;
    case "B":
      go_backward(10);
      break;
    }
    setImmediate(interactive_mode);
  });
}

if(jsys.type == "fog") {
  setImmediate(interactive_mode);
}
