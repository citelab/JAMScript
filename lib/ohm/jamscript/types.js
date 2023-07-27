const types = require("./types.json");
const astify = require("./cAstMatcher").astify;

arrayTypeRegistry = new Map();

function checkType(input) {
    if(types[input] === undefined)
        throw(input + " is not a JAMScript compatible type");
}

module.exports = {
    getJamlibCode: function(input) {
        checkType(input);
        return types[input].jamlib;
    },
    getCCode: function(input) {
        checkType(input);
        return types[input].c_code;
    },
    checkNeedsBuffer: function(input) {
        checkType(input);
        return types[input].buffer;
    },
    getCType: function(input) {
        checkType(input);
        return types[input].c_type;
    },
    getCEnum: function(input) {
        checkType(input);
        return types[input].c_enum;
    },
    registerArrayType: function(type, length) {
        let name = `__jarraytype_${type.replaceAll(' ', '_')}_${length}`;
        if (!arrayTypeRegistry.has(name))
            arrayTypeRegistry.set(name, [type, length]);
        return name;

    },
    generateArrayDefs: function() {
        var defs = [];
        for (var [name, gen] of arrayTypeRegistry) {
            var len = gen[0] === "char" || gen[0] === "unsigned char" ? 1 + parseInt(gen[1]) : gen[1];
            var e = astify(`NVOID_DEFINE_TYPE(${name}, 0, ${len});`, "Expr_stmt");
            e.expr.args[1] = gen[0];
            defs.push(e);
        }
        return defs;
    },
    stringifyType: function(jamtype) {
        return jamtype.unsigned ? "unsigned " + jamtype.name : jamtype.name;
    },
};
