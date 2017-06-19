var types = require('./types');


function createCStruct(elements) {
  var result = "{\n";
  for(var i = 0; i < elements.length; i++) {
    var currentElement = elements[i].name;
    if(elements[i].type instanceof Object) {
      result += `struct ${currentElement} ${createCStruct(elements[i].type)} ${currentElement};\n`;
    } else {
      result += elements[i].type + ' ' + currentElement + ";\n";
    }
  }
  result += "}";
  return result;
}

module.exports = {
  createCVariables: function (globals) {
    var cout = '';
    globals.forEach(function (value, key, map) {
      if (value.type === 'jdata') {
        if (value.jdata_type === 'broadcaster') {
          if(value.type_spec instanceof Object) {
            cout += 'struct _' + key + createCStruct(value.type_spec) + ';\n';
            cout += `struct _${key} *${key} = (struct _${key} *)calloc(1, sizeof(struct _${key}));`;
          } else {
            cout += `jbroadcaster *${key};\n`;
          }
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
          if(!value.type_spec instanceof Object) {
            cout += `${key} = jambroadcaster_init(${types.getJBroadcastCode(value.type_spec)}, "global", "${key}", NULL);\n`;
          }
        }
      }
    });
    return cout;
  },
  createJdataCall: function (namespace, id, value, type, spec) {
    if (type === "broadcaster") {
      throw 'Cannot declare broadcaster ' + id;
    } else if (type === "logger") {
      if (spec === "char" || spec === "char*") {
        return `jamdata_log_to_server("${namespace}", "${id}", ${value}, ((void*)0));`;
      } else {
        var cout = `sprintf(jdata_buffer, "${types.getFormatSpecifier(spec)}", ${value});\n`;
        cout += `jamdata_log_to_server("${namespace}", "${id}", jdata_buffer, ((void*)0));`;
        return cout;
      }
    }
  },
  createStructCallParams: function(elements, parent, assignmentMap) {
    var result = [];
    for(var i = 0; i < elements.length; i++) {
      var currentElement = parent + elements[i].name;
      if(elements[i].type instanceof Object) {
        result = result.concat(this.createStructCallParams(elements[i].type, currentElement + '.', assignmentMap));
      } else {
        if(assignmentMap.has(currentElement)) {
          result.push('"' + currentElement + '"', assignmentMap.get(currentElement), types.getJBroadcastCode(elements[i].type));
        } else {
          throw 'Field ' + currentElement + ' is not set';
        }
      }
    }
    return result;
  }
};