var types = require('./types');


function createCStruct(struct) {
    var elements = struct.entries;
    var result = `struct ${struct.name} {\n`;
    for (var i = 0; i < elements.length; i++) {
        var currentElement = elements[i].name;
        if (elements[i].type instanceof Object) {
            result += createCStruct(elements[i].type) + ' ' + currentElement + ";\n"
        } else {
            result += elements[i].type + ' ' + currentElement + ";\n";
        }
    }
    result += "}";
    return result;
}

module.exports = {
    createCVariables: function(globals) {
        var cout = '';
        globals.forEach(function(value, key, map) {
            if (value.type === 'jdata') {
                if (value.type_spec instanceof Object) {
                    cout += createCStruct(value.type_spec) + ';\n';
                }
                if (value.jdata_type === 'dflow') {
                    //cout += `jambroadcaster_t *${key};\n`;
                    // FIXME: what is the new C interface?
                }
            }
        });
        return cout;
    },
    linkCVariables: function(globals) {
        var cout = '';
        globals.forEach(function(value, key, map) {
            if (value.type === 'jdata') {
                if (value.jdata_type === 'dflow') {
                    // Check for struct
                    if (value.type_spec instanceof Object) {
                        //cout += `${key} = jambroadcaster_init(BCAST_RETURNS_NEXT, "global.cbor", "${key}");\n`;
                        // FIXME: what is the new C interface?
                    } else {
                        //cout += `${key} = jambroadcaster_init(BCAST_RETURNS_NEXT, "global", "${key}");\n`;
                        // FIXME: what is the new C interface?
                    }
                }
            }
        });
        return cout;
    },
    createJdataCall: function(namespace, id, value, type, spec) {
        if (type === "dflow") {
            throw 'Cannot declare dflow ' + id;
        } else if (type === "uflow" || type === "shuffler" ) {
            if (spec === "char" || spec === "char*") {
                return `jamdata_uflow_string("${namespace}", "${id}", ${value});`;
            } else if(spec === "int") {
                return `jamdata_uflow_int("${namespace}", "${id}", ${value});`;
            } else if(spec === "float") {
                return `jamdata_uflow_float("${namespace}", "${id}", ${value});`;
            } else {
                throw "Unable to use " + type + " with type " + spec;
            }
        }
    },
    createStructCallParams: function(elements, parent, assignmentMap) {
        var result = {
            formatString: "",
            valueArray: []
        };

        for (var i = 0; i < elements.length; i++) {
            var currentElement = parent + elements[i].name;
            if (elements[i].type instanceof Object) {
                var recurseResult = this.createStructCallParams(elements[i].type, currentElement + '.', assignmentMap);
                result.formatString += recurseResult.formatString;
                result.valueArray = result.valueArray.concat(recurseResult.valueArray);
            } else {
                if (assignmentMap.has(currentElement)) {
                    result.formatString += types.getCCode(elements[i].type);
                    result.valueArray.push('"' + currentElement + '"', assignmentMap.get(currentElement));
                } else {
                    throw 'Field ' + currentElement + ' is not set';
                }
            }
        }
        return result;
    },
    createStructDecode: function(structName, elements, parent) {
        var result = {
            count: 0,
            offsetArray: [],
            formatString: ""
        };

        for (var i = 0; i < elements.length; i++) {
            var currentElement = parent + elements[i].name;
            if (elements[i].type instanceof Object) {
                var recurseResult = this.createStructDecode(structName, elements[i].type.entries, currentElement + '.');
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
};
