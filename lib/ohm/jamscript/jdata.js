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
    createFormatAndArray: function(param, elements) {
        let result = {
            formatString: "",
            valueArray: []
        };

        let prefix =  (param.includes('&') ? param + "." : param + "->")

        for (let i = 0; i < elements.length; i++) {
            result.formatString += types.getCCode(elements[i].type);
            result.valueArray.push('"' + elements[i].name + '"')
            result.valueArray.push(prefix + elements[i].name);
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
