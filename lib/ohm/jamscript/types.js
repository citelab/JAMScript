const types = require("./types.json");
const astify = require("./cAstMatcher").astify;

arrayTypeRegistry = new Map();
structTypeRegistry = new Map();

function castArrayToPointer(expr, atype) {
    return {
        type: "Cast_expr",
        cast_type: astify(`struct ${atype}*`, "Type_name"),
        expr: {
            type: "Paren_expr",
            expr: expr,
        },
    };
}

module.exports = {
    get: function(jamtype) {
        if (jamtype.type === "Jamparam_decl_String") {
            return types["string"]
        } else if (jamtype.type === "Jamparam_decl") {
            if (jamtype.array)
                return jamtype.jamtype.unsigned ? types["array"]["unsigned"][jamtype.jamtype.name] : types["array"][jamtype.jamtype.name];
            return this.get(jamtype.jamtype);
        } else if (jamtype.type === "Jamtype_return_Array")
            return jamtype.jamtype.unsigned ? types["array"]["unsigned"][jamtype.jamtype.name] : types["array"][jamtype.jamtype.name];
        else if (jamtype.type === "Jamtype") {
            if (jamtype.unsigned)
                return types["unsigned"][jamtype.name];
            return types[jamtype.name];

        }
        return types["void"];
    },
    registerArrayType: function(type, length) {
        let name = `__jarraytype_${type.replaceAll(' ', '_')}_${length}`;
        if (!arrayTypeRegistry.has(name))
            arrayTypeRegistry.set(name, [type, length]);
        return name;
    },
    registerStructType: function(struct_name, struct_entires) {
        if (structTypeRegistry.has(struct_name))
            return; // TODO should do a typecheck here
        var struct = new Map();
        for (var entry of struct_entries) {
            var jamtype = this.stringifyType(entry.jamtype);
            if (entry.array)
                jamtype = registerArrayType(jamtype, entry.array);
            struct.set(entry.name.name, jamtype);
        }
        structTypeRegistry.set(struct_name, struct);
    },
    generateDefs: function(defs = []) {
        for (var [name, gen] of arrayTypeRegistry) {
            var len = gen[0] === "char" || gen[0] === "unsigned char" ? 1 + parseInt(gen[1]) : gen[1];
            var e = astify(`NVOID_DEFINE_TYPE(${name}, 0, ${len});`, "Expr_stmt");
            e.expr.args[1] = gen[0];
            defs.push(e);
        }
        for (var [name, gen] of structTypeRegistry) {
            var entries = "";
            for (var [field, type] of gen)
                entries += `${type} ${field};`;
            defs.push(astify(`struct ${name} {${entries}};`, "Decl"));
        }
        return defs;
    },
    stringifyType: function(jamtype) {
        if (jamtype.type === "Jamparam_decl_String")
            return "char* " + jamtype.name.name;
        if (jamtype.type === "Jamparam_decl")
            return this.stringifyType(jamtype.jamtype) + " " + jamtype.name.name + (jamtype.array?"[]":"");
        if (jamtype.type === "Jamtype")
            return jamtype.unsigned ? "unsigned " + jamtype.name : jamtype.name;
        if (jamtype.type === "Jamtype_return_Array")
            return this.stringifyType(jamtype.jamtype) + "[" + jamtype.array + "]";
        if (jamtype.type === "Jdata_spec_Basic")
            return this.stringifyType(jamtype.jamtype);
        if (jamtype.type === "Jdata_spec_Array")
            return this.stringifyType(jamtype.jamtype);
        return "void";
    },
    castLocalArgs: function(args, types) { // Need to cast to the correct array type
        if (args.length != types.length)
            throw "ERROR: argument length mismatch in local C call";
        var newArgs = [];
        for (var i=0; i < args.length; i++) {
            if (types[i].array) {
                var atype = this.registerArrayType(this.stringifyType(types[i].jamtype), 1);
                newArgs.push(castArrayToPointer(args[i], atype));
            } else
                newArgs.push(args[i]);
        }
        return newArgs;
    },
    castRemoteArgs: function(args, types) { // Cast arrays to an nvoid because immediately encode
        if (args.length != types.length)
            throw "ERROR: argument length mismatch in remote C call";
        var newArgs = [];
        for (var i=0; i < args.length; i++) {
            if (types[i].array)
                newArgs.push(castArrayToPointer(args[i], "_nvoid_t"));
            else
                newArgs.push(args[i]);
        }
        return newArgs;
    },
};
