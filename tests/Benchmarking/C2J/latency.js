var counter = 0;
var accumulator = 0;

jtask* function remoteCall(test) {
  
  let date = new Date();
  
  var components = test.split(':');
  var subcomponents = components[2].split('.');
  
  let hours = parseInt(components[0]);
  let minutes = parseInt(components[1]);
  let seconds = parseInt(subcomponents[0]);
  let milli = Math.trunc(parseInt(subcomponents[1])/1000000);

  let our_hours = date.getHours();
  let our_minutes = date.getMinutes();
  let our_seconds = date.getSeconds();
  let our_milli = date.getMilliseconds();

//  aconsole.log(hours, minutes,seconds,milli);
//  console.log(our_hours, our_minutes, our_seconds, our_milli);

  let diff_hours   = our_hours-hours;
  let diff_minutes = our_minutes-minutes + diff_hours*60;
  let diff_seconds = our_seconds-seconds + diff_minutes*60;
  let diff_milli   = our_milli-milli + diff_seconds*1000;
  
  counter += 1;
  accumulator += diff_milli;

//  console.log(diff_milli);
}

setInterval(() => {
  let average_overhead = accumulator/counter;
  console.log("Overhead: " + average_overhead + " milliseconds");
  
  counter = 0;
  accumulator = 0;
}, 1000);
