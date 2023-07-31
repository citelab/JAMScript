const types = require("./types.json");
const astify = require("./cAstMatcher").astify;

arrayTypeRegistry = new Map();

module.exports = {
    get: function(jamtype) {
        if (jamtype.type === "Jamparam_decl") {
            if (jamtype.array)
                return types["array"];
            return types[jamtype.jamtype.name];
        } else if (jamtype.type === "Jamtype_return_Array")
            return types["array"];
        else if (jamtype.type === "Jamtype")
            return types[jamtype.name];
        return types["void"];
    },
    registerArrayType: function(type, length) {
        let name = `__jarraytype_${type.replaceAll(' ', '_')}_${length}`;
        if (!arrayTypeRegistry.has(name))
            arrayTypeRegistry.set(name, [type, length]);
        return name;

    },
    generateArrayDefs: function(defs = []) {
        for (var [name, gen] of arrayTypeRegistry) {
            var len = gen[0] === "char" || gen[0] === "unsigned char" ? 1 + parseInt(gen[1]) : gen[1];
            var e = astify(`NVOID_DEFINE_TYPE(${name}, 0, ${len});`, "Expr_stmt");
            e.expr.args[1] = gen[0];
            defs.push(e);
        }
        return defs;
    },
    stringifyType: function(jamtype) {
        if (jamtype.type === "Jamparam_decl")
            return this.stringifyType(jamtype.jamtype) + " " + jamtype.name.name + (jamtype.array?"[]":"");
        if (jamtype.type === "Jamtype")
            return jamtype.unsigned ? "unsigned " + jamtype.name : jamtype.name;
        if (jamtype.type === "Jamtype_return_Array")
            return this.stringifyType(jamtype.jamtype) + "[" + jamtype.array + "]";
        return "void";
    },
    castLocalArgs: function(args, types) {
        if (args.length != types.length)
            throw "ERROR: argument length mismatch in local C call";
        var newArgs = [];
        for (var i=0; i < args.length; i++) {
            var typeInfo = this.get(types[i]);
            if (typeInfo.c_type === "nvoid_t*") {
                var atype = this.registerArrayType(types.stringifyType(types[i].jamtype));
                newArgs.push({
                    type: "Cast_expr",
                    cast_type: `${atype}*`,
                    expr: {
                        type: "Paren_expr",
                        expr: args[i];
                    },
                });
            } else
                newArgs.push(args[i]);
        }
    },
};
