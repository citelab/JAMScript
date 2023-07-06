var types = require("./types.json");

function checkType(input) {
    if(types[input] === undefined)
        throw(input + " is not a JAMScript compatible type");
}

module.exports = {
    // getFormatSpecifier: function(input) {
    //     checkType(input);
    //     return types[input].c_pattern;
    // },
    getJamlibCode: function(input) {
        checkType(input);
        return types[input].jamlib;
    },
    // getJSType: function(input) {
    //     checkType(input);
    //     return types[input].js_type;
    // },
    getCCode: function(input) {
        checkType(input);
        return types[input].c_code;
    },
    // getJSCode: function(input) {
    //     checkType(input);
    //     return types[input].js_code;
    // },
    // getStringCast: function(input) {
    //     checkType(input);
    //     return types[input].caster;
    // }
};
