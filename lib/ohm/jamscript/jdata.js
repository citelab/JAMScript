var types = require('./types');


function createCStruct(struct) {
<<<<<<< HEAD
  var elements = struct.entries;
  var result = `struct ${struct.name} {\n`;
  for(var i = 0; i < elements.length; i++) {
    var currentElement = elements[i].name;
    if(elements[i].type instanceof Object) {
      result += createCStruct(elements[i].type) + ' ' + currentElement + ";\n"
    } else {
      result += elements[i].type + ' ' + currentElement + ";\n";
=======
    var elements = struct.entries;
    var result = `struct ${struct.name} {\n`;
    for (var i = 0; i < elements.length; i++) {
        var currentElement = elements[i].name;
        if (elements[i].type instanceof Object) {
            result += createCStruct(elements[i].type) + ' ' + currentElement + ";\n"
        } else {
            result += elements[i].type + ' ' + currentElement + ";\n";
        }
>>>>>>> JAMScript-beta/master
    }
    result += "}";
    return result;
}

module.exports = {
<<<<<<< HEAD
  createCVariables: function (globals) {
    var cout = '';
    globals.forEach(function (value, key, map) {
      if (value.type === 'jdata') {
        if(value.type_spec instanceof Object) {
          cout += createCStruct(value.type_spec) + ';\n';
        }
        if (value.jdata_type === 'broadcaster') {
          cout += `jbroadcaster *${key};\n`;
        }
      }
    });
    return cout;
  },
  linkCVariables: function (globals) {
    var cout = '';
    globals.forEach(function (value, key, map) {
      if (value.type === 'jdata') {
        if (value.jdata_type === 'broadcaster') {
          // Check for struct
          if(value.type_spec instanceof Object) {
            cout += `${key} = jambroadcaster_init(JBROADCAST_STRING, "global", "${key}", NULL);\n`;
          } else {
            cout += `${key} = jambroadcaster_init(${types.getJBroadcastCode(value.type_spec)}, "global", "${key}", NULL);\n`;
          }
=======
    createCVariables: function(globals) {
        var cout = '';
        globals.forEach(function(value, key, map) {
            if (value.type === 'jdata') {
                if (value.type_spec instanceof Object) {
                    cout += createCStruct(value.type_spec) + ';\n';
                }
                if (value.jdata_type === 'broadcaster') {
                    cout += `jambroadcaster_t *${key};\n`;
                }
            }
        });
        return cout;
    },
    linkCVariables: function(globals) {
        var cout = '';
        globals.forEach(function(value, key, map) {
            if (value.type === 'jdata') {
                if (value.jdata_type === 'broadcaster') {
                    // Check for struct
                    if (value.type_spec instanceof Object) {
                        cout += `${key} = jambroadcaster_init(BCAST_RETURNS_NEXT, "global.cbor", "${key}");\n`;
                    } else {
                        cout += `${key} = jambroadcaster_init(BCAST_RETURNS_NEXT, "global", "${key}");\n`;
                    }
                }
            }
        });
        return cout;
    },
    createJdataCall: function(namespace, id, value, type, spec) {
        if (type === "broadcaster") {
            throw 'Cannot declare broadcaster ' + id;
        } else if (type === "logger") {
            if (spec === "char" || spec === "char*") {
                return `jamdata_log_to_server("${namespace}", "${id}", ${value}, 0);`;
            } else {
                var cout = `sprintf(jdata_buffer, "${types.getFormatSpecifier(spec)}", ${value});\n`;
                cout += `jamdata_log_to_server("${namespace}", "${id}", jdata_buffer, 0);`;
                return cout;
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
>>>>>>> JAMScript-beta/master
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
