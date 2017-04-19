var types = require('./types');

module.exports = {
  generateJSLoggerVars: function (globals) {
    var jsout = '';
    globals.forEach(function (value, key, map) {
      if (value.type == 'jdata namespace') {
        jsout += `var ${key} = {\n`
        var children = value.children;
        children.forEach(function (v, k, m) {
          if (v.jdata_type == 'broadcaster') {
            jsout += `\t${k}: new JAMLogger(JAMManager, "${key}.${k}"),\n`;
          }
        });
        jsout += '};\n';
      } else if (value.type == 'jdata' && value.jdata_type == 'logger') {
        jsout += `var ${key} = new JAMLogger(JAMManager, "${key}");\n`;
      }
    });
    return jsout;
  },
  createCVariables: function (globals) {
    var cout = '';
    globals.forEach(function (value, key, map) {
      if (value.type === 'jdata') {
        if (value.jdata_type === 'broadcaster') {
          cout += `jbroadcaster *${key};\n`;
        } else if (value.jdata_type === 'shuffler') {
          cout += `jshuffler *${key};\n`;
        }
      } else if (value.type == "jdata namespace") {
        cout += `struct ${key} {\n`;
        var children = value.children;
        children.forEach(function (v, k, m) {
          if (v.jdata_type == 'broadcaster') {
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
        if (value.jdata_type == 'broadcaster') {
          cout += `${key} = jambroadcaster_init(${types.getJBroadcastCode(value.type_spec)}, "global", "${key}", NULL);\n`;
        } else if (value.jdata_type == 'jshuffler') {
          cout += `${key} = jshuffler_init(${types.getJBroadcastCode(value.type_spec)}, "${key}", NULL);\n`;
        }
      } else if (value.type == "jdata namespace") {
        var children = value.children;
        children.forEach(function (v, k, m) {
          if (v.jdata_type == 'broadcaster') {
            cout += `${key}.${k} = jambroadcaster_init(${types.getJBroadcastCode(v.type_spec)}, "${k}", "${key}", NULL);\n`;
          } else if (v.jdata_type == 'broadcaster') {
            cout += `${key}.${k} = jshuffler_init(${types.getJBroadcastCode(v.type_spec)}, "${k}", "${key}", NULL);\n`;
          }
        });
      }
    });
    return cout;
  }
}

