var types = require('./types');
const astify = require('./cAstMatcher').astify;

function createCStruct(struct) {
    var result = `struct ${struct.name} {`;
    for (let elem in struct.entries)
        result += (elem.type instanceof Object ? createCStruct(elem.type) : elem.type) + " " + elem.name + ";"
    return result + "}";
}
// DEAD CODE -- to delete (?)
function createStructDecode(structName, elements, parent) {
    var result = {
        count: 0,
        offsetArray: [],
        formatString: ""
    };

    for (var i = 0; i < elements.length; i++) {
        var currentElement = parent + elements[i].name;
        if (elements[i].type instanceof Object) {
            var recurseResult=this.createStructDecode(structName, elements[i].type.entries, currentElement+'.');
            result.count += recurseResult.count;
            result.offsetArray = result.offsetArray.concat(recurseResult.offsetArray);
            result.formatString += recurseResult.formatString;
        } else {
            result.count++;
            result.offsetArray.push(`offsetof(struct ${structName}, ${currentElement})`);
            result.formatString += types.getCCode(elements[i].type);
        }
    }
    return result;
}

module.exports = {
    createCVariables: function(globals) {
        let decls = [astify("dpanel_t *dp;", "Decl")];
        let func = astify("void dp_flow_defs(){}", "Function_def");
        globals.forEach(function(value, key, map) {
            if (value.type !== 'jdata')
                return;
            if (value.type_spec instanceof Object)
                decls.push(astify(createCStruct(value.type_spec) + ";"), "Decl");

            if (value.jdata_type === 'uflow') {
                decls.push(astify(`uftable_entry_t* ${key};`, "Decl"));
                func.block.body.push(astify(`${key} = dp_create_uflow(dp, "${key}", "i");`, "Expr_stmt"));
            } else if (value.jdata_type === 'dflow') {
                decls.push(astify(`dftable_entry_t* ${key};`, "Decl"));
                func.block.body.push(astify(`${key} = dp_create_dflow(dp, "${key}", "i");`, "Expr_stmt"));
            }
        });
        decls.push(func);
        return decls;
    },
    createFormatAndArray: function(param, elements) { // idk what this does
        let result = {
            formatString: "",
            valueArray: []
        };

        let prefix =  (param.includes('&') ? param.slice(1, param.length) + "." : param + "->");

        for (let i = 0; i < elements.length; i++) {
            result.formatString += types.getCCode(elements[i].type);
            result.valueArray.push('"' + elements[i].name + '"')
            result.valueArray.push(prefix + elements[i].name);
        }

        return result;
    },
    createFormatAndArrayForRead: function(param, elements) { // ditto
        let result = {
            formatString: "",
            valueArray: []
        };

        let prefix =  (param.includes('&') ? param.slice(1, param.length) + "." : param + "->")

        for (let i = 0; i < elements.length; i++) {
            result.formatString += types.getCCode(elements[i].type);
            result.valueArray.push('"' + elements[i].name + '"')
            result.valueArray.push('&(' + prefix + elements[i].name + ')');
        }

        return result;
    },
};
