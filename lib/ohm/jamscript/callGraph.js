var activityMatrix = require('./activityMatrix.json');
var symbolTable = require('./symbolTable');

module.exports = {
  graph: {
    c: new Map(),
    js: new Map()
  },
  addFunction: function (language, name) {
    if (!this.graph[language].has(name)) {
      this.graph[language].set(name, {
        type: 'function',
        calls: new Map()
      });
    }
  },
  addActivity: function (language, name, type) {
    if (!this.graph[language].has(name)) {
      this.graph[language].set(name, {
        type: type,
        calls: new Map()
      });
    }
  },
  addCall: function (language, source, destination, parameters) {
    var sourceFunctionCalls = this.graph[language].get(source).calls;
    var destinationArgumentCalls = sourceFunctionCalls.get(destination);

    if (destinationArgumentCalls === undefined) {
      sourceFunctionCalls.set(destination, new Set([parameters]));
    } else {
      destinationArgumentCalls.add(parameters);
    }
  },
  resetCallGraph: function (language) {
    this.graph[language] = new Map();
  },
  pruneJSCallGraph: function () {
    this.graph.js.forEach(function (target, sourceFunction, map) {
      var calls = target.calls;
      for (let call of calls.keys()) {
        if (!(symbolTable.functions.js.has(call) || symbolTable.activities.js.has(call) || symbolTable.activities.c.has(call))) {
          calls.delete(call);
        }
      }
    });
  },
  getCallGraph: function () {
    return this.graph;
  },
  checkCalls: function () {
    // this.graph.js.forEach(function(data, sourceFunction) {
    //   var sourceSymbol = symbolTable.get(sourceFunction);
    //   for (let call of data.calls.keys()) {
    //     var targetSymbol = symbolTable.get(call);
    //     if(data.type !== "function") {
    //       if(!activityMatrix['js'][data.type][targetSymbol.language][targetSymbol.activityType]) {
    //         throw(`Cannot call ${targetSymbol.language} ${targetSymbol.activityType} activity ${call} from ${language} ${data.type} activity ${sourceFunction}`);
    //       }
    //     }
    //     if(targetSymbol.language === "js" && targetSymbol.activityType === "sync") {
    //       throw(`Cannot call javascript synchrnous activity ${call} from function ${sourceFunction}, javscript sync calls must be at top level`);
    //     }
    //   }
    // });
    // this.graph.c.forEach(function(data, sourceFunction) {
    //   var sourceSymbol = symbolTable.get(sourceFunction);
    //   for (let call of data.calls.keys()) {
    //     if(data.type !== "function") {
    //       var targetSymbol = symbolTable.get(call);
    //       if(!activityMatrix['js'][data.type][targetSymbol.language][targetSymbol.activityType]) {
    //         throw(`Cannot call ${targetSymbol.language} ${targetSymbol.activityType} activity ${call} from ${language} ${data.type} activity ${sourceFunction}`);
    //       }
    //     }
    //   }
    // });

    for (const language of Object.keys(this.graph)) {
      var entries = this.graph[language];
      entries.forEach(function (data, sourceFunction, map) {
        var sourceSymbol = symbolTable.get(sourceFunction);
        if (data.type !== "function") {
          for (let call of data.calls.keys()) {
            var targetSymbol = symbolTable.get(call);
            if (targetSymbol !== "function") {
                if (!activityMatrix['js'][data.type][targetSymbol.language][targetSymbol.activityType]) {
                  throw (`Cannot call ${targetSymbol.language} ${targetSymbol.activityType} activity ${call} from ${language} ${data.type} activity ${sourceFunction}`);
                }
            }
          }
        }
      });
    }
  },
  createWebpage: function () {
    var output = "";
    output += '<html>\n';
    output += '<head>\n';
    output += '<script src="https://code.jquery.com/jquery-3.2.1.min.js"></script>\n';
    output += '<script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/2.7.24/cytoscape.js"></script>\n';
    output += '<script src="http://marvl.infotech.monash.edu/webcola/cola.v3.min.js"></script>\n';
    output += '<script src="https://cdn.rawgit.com/cytoscape/cytoscape.js-qtip/2.7.0/cytoscape-qtip.js"></script>\n';
    output += '<script src="https://cdn.rawgit.com/cytoscape/cytoscape.js-cola/1.6.0/cytoscape-cola.js"></script>\n';
    output += '<script src="http://cdn.rawgit.com/cpettitt/dagre/v0.7.4/dist/dagre.min.js"></script>\n';
    output += '<script src="https://cdn.rawgit.com/cytoscape/cytoscape.js-dagre/1.5.0/cytoscape-dagre.js"></script>\n';
    output += '<script src="http://cdn.jsdelivr.net/qtip2/3.0.3/jquery.qtip.min.js"></script>\n';
    output += '<link rel="stylesheet" type="text/css" href="http://cdn.jsdelivr.net/qtip2/3.0.3/jquery.qtip.min.css" />\n';
    output += '<style type="text/css"> #cy { height: 100%; width: 100%; position: absolute; left: 0; top: 0; } </style>\n';
    output += '<title>Callgraph</title>\n';
    output += '<script>\n';
    output += this.printCytoscape();
    output += `$(function(){
  var cy = cytoscape({
  container: document.getElementById('cy'),

  boxSelectionEnabled: false,
  autounselectify: true,

  style: [
    {
      selector: 'node',
      css: {
        'content': 'data(label)'
      }
    },
    {
      selector: ':child',
      css: {
        'text-valign': 'center',
        'text-halign': 'center',
        'shape': 'data(shape)',
        'width': '100',
        'background-color': '#FFFFFF',
        'font-size': '12'
      }
    },
    {
      selector: ':parent',
      css: {
        'text-valign': 'top',
        'text-halign': 'center',
        'background-color': 'data(color)'
      }
    },
    {
      selector: 'edge',
      css: {
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'content': 'data(label)'
      }
    }
  ],
  elements: {
    nodes: nodes,
    edges: edges
  },
  layout: {
    name: 'dagre'
  }
});
cy.nodes(':child').qtip({
    content: function() {
      return this.data('id');
    },
    position: {
      my: 'bottom center',
      at: 'top center'
    },
    style: {
      classes: 'qtip-bootstrap',
      tip: {
        width: 16,
        height: 8
      }
    }
  });
  cy.edges().qtip({
    content: function() {
      return '<table><th>Calls</th>' + this.data('calls') + '</table>';
    },
    position: {
      my: 'bottom center',
      at: 'top center'
    },
    style: {
      classes: 'qtip-bootstrap',
      tip: {
        width: 16,
        height: 8
      }
    }
  });
  });\n`;
    output += '</script>\n';
    output += '</head>\n';
    output += '<body>\n';
    output += '<div id="cy"></div>\n';
    output += '</body>\n';
    output += '</html>\n';
    return output;
  },
  printCytoscape: function () {
    var output = 'var nodes = [ \n';
    output += `{data: {id: "c", label: "C", color: "#6FB1FC"}},\n`;
    output += `{data: {id: "js", label: "JavaScript", color: "#9fd849"}},\n`;

    if (this.graph.c.size > 0) {
      this.graph.c.forEach(function (data, func) {
        var shape = "ellipse";
        if (data.type !== "function") {
          shape = "roundrectangle";
        }
        var label = func;
        if (label.length > 25) {
          label = label.substring(0, 22) + "...";
        }
        output += `{data: {id: '${func}', label: '${label}', parent: 'c', shape: '${shape}'}},\n`;
      });
    }
    if (this.graph.js.size > 0) {
      this.graph.js.forEach(function (data, func) {
        var shape = "ellipse";
        if (data.type !== "function") {
          shape = "roundrectangle";
        }
        var label = func;
        if (label.length > 25) {
          label = label.substring(0, 22) + "...";
        }
        output += `{data: {id: '${func}', label: '${label}', parent: 'js', shape: '${shape}'}},\n`;
      });
    }

    output += '];\n';
    output += 'var edges = [\n';
    if (this.graph.c.size > 0) {
      this.graph.c.forEach(function (target, source) {
        var calls = target.calls;
        calls.forEach(function (arguments, call) {
          var tooltipTable = "";
          arguments.forEach(function (args) {
            tooltipTable += `<tr><td>${args}</td></tr>`;
          });
          output += `{data: {id: "${source + call}", source: "${source}", target: "${call}", calls: "${tooltipTable}"}},\n`;
        });
      });
    }
    if (this.graph.js.size > 0) {
      this.graph.js.forEach(function (target, source) {
        var calls = target.calls;
        calls.forEach(function (arguments, call) {
          var tooltipTable = "";
          arguments.forEach(function (args) {
            tooltipTable += `<tr><td>${args}</td></tr>`;
          });
          output += `{data: {id: "${source + call}", source: "${source}", target: "${call}", calls: "${tooltipTable}"}},\n`;
        });
      });
    }
    output += '];\n';
    return output;
  },
  createDOT: function () {
    var output = 'digraph jamgraph{\n';
    var callList = '';
    var usedFunctions;
    if (this.graph.c.size > 0) {
      usedFunctions = new Set();
      output += 'subgraph cluster_0 {\n';
      output += 'label = "C Functions";\n';
      this.graph.c.forEach(function (data, source, map) {
        // graph += source + ';\n';
        // if(calls.size > 0) {
        usedFunctions.add(source);
        // }
        data.calls.forEach(function (arguments, call) {
          if (map.has(call)) {
            usedFunctions.add(call);
          }
          arguments.forEach(function (args) {
            callList += source + ' -> ' + call + ' [ label="' + args + '" ];\n';
          });
        });
      });
      usedFunctions.forEach(function (func) {
        output += func + ';\n';
      });
      output += '}\n';
    }
    if (this.graph.js.size > 0) {
      usedFunctions = new Set();
      output += 'subgraph cluster_1 {\n';
      output += 'label = "J Functions";\n';
      this.graph.js.forEach(function (data, source, map) {
        // output += source + ';\n';
        usedFunctions.add(source);
        data.calls.forEach(function (arguments, call) {
          if (map.has(call)) {
            usedFunctions.add(call);
          }
          arguments.forEach(function (args) {
            callList += source + ' -> ' + call + ' [ label="' + args + '" ];\n';
          });
        });
      });
      usedFunctions.forEach(function (func) {
        output += func + ';\n';
      });
      output += '}\n';
    }

    output += callList;
    output += '}';
    return output;
  }
};
