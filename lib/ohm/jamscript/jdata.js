var types = require('./types');

module.exports = {
  createCVariables: function (globals) {
    var cout = '';
    globals.forEach(function (value, key, map) {
      if (value.type === 'jdata') {
        if (value.jdata_type === 'broadcaster') {
          cout += `jbroadcaster *${key};\n`;
        } else if (value.jdata_type === 'shuffler') {
          cout += `jshuffler *${key};\n`;
        }
      } else if (value.type === "jdata namespace") {
        cout += `struct ${key} {\n`;
        var children = value.children;
        children.forEach(function (v, k, m) {
          if (v.jdata_type === 'broadcaster') {
            cout += `jbroadcaster *${k};\n`
          } else if (v.jdata_type === 'shuffler') {
            cout += `jshuffler *${key};\n`;
          }
        });
        cout += `} ${key};\n`;
      }
    });
    return cout;
  },
  linkCVariables: function (globals) {
    var cout = '';
    globals.forEach(function (value, key, map) {
      if (value.type === 'jdata') {
        if (value.jdata_type === 'broadcaster') {
          cout += `${key} = jambroadcaster_init(${types.getJBroadcastCode(value.type_spec)}, "global", "${key}", NULL);\n`;
        } else if (value.jdata_type === 'jshuffler') {
          cout += `${key} = jshuffler_init(${types.getJBroadcastCode(value.type_spec)}, "${key}", NULL);\n`;
        }
      } else if (value.type === "jdata namespace") {
        var children = value.children;
        children.forEach(function (v, k, m) {
          if (v.jdata_type === 'broadcaster') {
            cout += `${key}.${k} = jambroadcaster_init(${types.getJBroadcastCode(v.type_spec)}, "${k}", "${key}", NULL);\n`;
          } else if (v.jdata_type === 'broadcaster') {
            cout += `${key}.${k} = jshuffler_init(${types.getJBroadcastCode(v.type_spec)}, "${k}", "${key}", NULL);\n`;
          }
        });
      }
    });
    return cout;
  },
  createJdataCall: function (namespace, id, value, type, spec) {
    if (type === "broadcaster") {
      error('Cannot declare broadcaster ' + id);
    } else if (type === "logger") {
      if (spec === "char" || spec === "char*") {
        return `jamdata_log_to_server("${namespace}", "${id}", ${value}, ((void*)0));`;
      } else {
        var cout = `sprintf(jdata_buffer, "${types.getFormatSpecifier(spec)}", ${value});\n`;
        cout += `jamdata_log_to_server("${namespace}", "${id}", jdata_buffer, ((void*)0));`;
        return cout;
      }
    } else if (type === "shuffler") {
      return `jshuffler_push(${id}, ${value});`;
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
}