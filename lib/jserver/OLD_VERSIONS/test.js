var regexp = /\$\$\$/g;
var foo = "$$$testapp$$$testapp|testdevice(2)$$$4$$$1469044675";
var match, matches = [];

while ((match = regexp.exec(foo)) != null) {
  matches.push(match.index);
}

console.log(matches);
