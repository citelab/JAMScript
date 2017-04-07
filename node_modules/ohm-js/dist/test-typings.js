"use strict";
exports.__esModule = true;
var __1 = require("..");
var g = __1["default"].grammar("\n  G {\n    Greeting = interjection \",\" name \"!\"\n    interjection = \"Hello\" | \"Hi\" | \"Ahoy-hoy\"\n    name = upper letter+\n  }\n");
var s = g.createSemantics().addOperation('getName', {
    Greeting: function (interj, comma, name, punc) {
        return name.sourceString;
    }
});
var matchResult = g.match('Ahoy-hoy, Alexander!');
console.log(s(matchResult).getName());
var matcher = g.matcher();
matcher.setInput('foo');
matcher.replaceInputRange(0, 1, 'g')
    .replaceInputRange(2, 4, 'ah');
if (matcher.match('Greeting').succeeded()) {
    console.log('input:', matcher.getInput());
}
