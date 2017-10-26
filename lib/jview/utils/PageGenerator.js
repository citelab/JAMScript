// PageGenerator
var fsPath = require('fs-path');
var fs = require('fs');
var storeGenerator = require('./StoreGenerator.js');

module.exports = function (pages, path) {
    // Important Temporary Stored Array for Pages and Associated Stores and Sockets
    var storeNames = [];/* saves Store Names */
    var storeDirectories = []; /* saves Store Directories */
    var pageNames = []; /* saves Page names */
    var pageRoutes = []; /* saves Page routes for __MainAppView() to bind pages together with react-router */
    var sockets = []; /* saves socket id and socket-assoicated store names */

    // Iterate through pages array in Config.json
    pages.map(page=> {
        // Save Route for Page (Defined in Config.json)
        pageRoutes.push(page.route);

        // Each page may have more than one panels:
        // Important Temporary Stored Array for Panels
        var panelNames = []; /* saves names of each panel, later used to generate code*/
        var panelViews = [];/*saves code block for static jsx panel view*/
        var panelStoreConnectors = [];/*saves connectors code block in React component to the stores*/
        var storeName; /* temporary store name */

        // Each page should have a page name, otherwise the NavMenu will have problem
        if (page.name) {
            // save this page name to later genearte routing and NavMenu
            pageNames.push(page.name.replace(/\s/g, ''));
            /* dive into the panels first, because you need to know the list of stores needed for your panels
             so you need to generate data layers files before writing to index.js, the main page
             also within this mapping function, the static view code block has to be generated, so that it just need to be appened later on */
            page.panels.map((panel, idx)=> {
                // process panel.type to eliminate spaces and make every char to lower case to reduce confusion
                panel.type = panel.type.replace(" ","").replace("-","").toLowerCase();

                // check if panel.name is present
                if(!panel.name) {
                    panel.name = panel.type.charAt(0).toUpperCase() + panel.type.slice(1);
                } else {
                    throw 'panel name missing';
                }

                panel.name = panel.name + __ExistsInArray(panelNames,panel.name);
                panelNames.push(panel.name);
                storeName = panel.name+'Store';
                storeNames.push(storeName);
                storeDirectories.push('./'+page.name.replace(/\s/g, '')+'/'+storeName);
                // Take Type and convert it to LowerCase to deal with different typing variations
                storeGenerator(storeName, panel, __PageDirectory(page.name, path)); //@ todo future problem with too many files with the same name?
                if (panel.type == 'formset') {
                    // Default methods for FormSet
                    panelStoreConnectors.push("const " + storeName + "_formset = this.props."+storeName+".formset;\nconst " + storeName + "Config = {\
                        reset: this.props." + storeName + ".reset.bind(this.props." + storeName + "),\
                        changeValue: this.props." + storeName + ".changeValue.bind(this.props." + storeName + ")\
                    }");
                    panelViews.push("<Panel title = \"" + panel.name + "\">\
                        <FormSet {..." + storeName + "_formset} {..." + storeName + "Config } />\
                    </Panel>");
                } else if (panel.type == 'table') {
                    panelStoreConnectors.push("const " + storeName + "_table = this.props."+storeName+".table;");
                    panelViews.push("<Panel title = \"" + panel.name + "\">\
                        <FixTable leftCol='1' rightCol='0' left='45' right='0' className='td-inner-txt'\
                    tableList={"+storeName + "_table}/>\
                        </Panel>")
                } else if (panel.type == 'scatter'){
                    sockets.push({id:panel.store.socket.id, storeName});
                    panelStoreConnectors.push("const " + storeName + "_scatter = this.props."+storeName+".scatter;");
                    panelViews.push("<Panel title = \"" + panel.name + "\">\
                        <Echarts style={{width:'100%',height:'365px'}} option={"+storeName+"_scatter}/>\
                    </Panel>");
                } else if (panel.type == 'pie'){
                    sockets.push({id:panel.store.socket.id, storeName});
                    panelStoreConnectors.push("const " + storeName + "_pie = this.props."+storeName+".pie;");
                    panelViews.push("<Panel title = \"" + panel.name + "\">\
                        <Echarts style={{width:'100%',height:'365px'}} option={"+storeName+"_pie}/>\
                    </Panel>");
                } else if (panel.type == 'graph'){
                    sockets.push({id:panel.store.socket.id, storeName});
                    panelStoreConnectors.push("const " + storeName + "_graph = this.props."+storeName+".graph;");
                    panelViews.push("<Panel title = \"" + panel.name + "\">\
                        <Echarts style={{width:'100%',height:'365px'}} option={"+storeName+"_graph}/>\
                    </Panel>");
                } else if (panel.type == 'stackedgraph'){
                    sockets.push({id:panel.store.socket.id, storeName});
                    panelStoreConnectors.push("const " + storeName + "_stackedgraph = this.props."+storeName+".stackedGraph;");
                    panelViews.push("<Panel title = \"" + panel.name + "\">\
                        <Echarts style={{width:'100%',height:'365px'}} option={"+storeName+"_stackedgraph}/>\
                    </Panel>");
                } else if (panel.type == 'controller'){
                    //sockets.push({id:panel.store.socket.id, storeName});
                    panelStoreConnectors.push("const " + storeName + "_controller = this.props."+storeName+".controller;\nconst " + storeName + "Config = {\
                        reset: this.props." + storeName + ".reset.bind(this.props." + storeName + "),\
                        changeValue: this.props." + storeName + ".changeValue.bind(this.props." + storeName + "),\
                        emitValue: this.props." + storeName + ".emitValue.bind(this.props." + storeName + ")\
                    }");
                    panelViews.push("<Panel title = \"" + panel.name + "\">\
                        <Controller {..." + storeName + "_controller} {..." + storeName + "Config} />\
                    </Panel>");
                } else if (panel.type == 'terminal'){
                    panelStoreConnectors.push("const " + storeName + "_terminal = this.props."+storeName+".terminal;\nconst " + storeName + "Config = {\
                        reset: this.props." + storeName + ".reset.bind(this.props." + storeName + "),\
                        changeValue: this.props." + storeName + ".changeValue.bind(this.props." + storeName + "),\
                        addCommand: this.props." + storeName + ".addCommand.bind(this.props." + storeName + ")\
                    }");
                    panelViews.push("<Panel title = \"" + panel.name + "\">\
                        <Terminal {..." + storeName + "_terminal} {..." + storeName + "Config} />\
                    </Panel>")
                }
            });

            //After knowing the store, generate page file in ES6 and React
            fsPath.writeFile(__RootFileName(page.name, path), '// Root File for Page ' + page.name, function (err, data) {
                if (err) throw err;
                console.log('Root File Created for Page : ' + page.name);

                // Create a write stream, and add in the writeLine() method
                var ws = fs.createWriteStream(__RootFileName(page.name, path), {flags: 'a'});
                ws.writeLine = (str)=> {
                    ws.write('\n');
                    ws.write(str);
                };
                ws.writeLine(__RootFileDependencies__);
                ws.writeLine(__StoreInjection(storeNames));
                ws.writeLine(__ClassHeader(page.name.replace(" ", "")));
                if(sockets.length != 0){
                    ws.writeLine("componentDidMount(){\
                        if(!this.socket) {\
                            this.socket = io.connect('/');\
                            this.socket.on('newDataPoint', function(data){\
                                "+sockets.map((e,idx)=>{
                                    return "if(data.body.id=="+e.id+")this.props."+e.storeName+".addDataPoints(data.body.x, data.body.y, data.body.gateIndex)"
                                }).join('\n')+"}.bind(this));\
                            this.socket.on('setArray', function(data){"+
                                sockets.map((e,idx)=>{
                                    return "if(data.body.id=="+e.id+")this.props."+e.storeName+".setArray(data.array, data.body.gateIndex)"
                                }).join('\n')+"}.bind(this));"+"}}");
                }
                ws.writeLine("render(){" + panelStoreConnectors[0]);
                if(panelStoreConnectors.length>1){
                    var index = 1;
                    while(index<panelStoreConnectors.length){
                        ws.writeLine(panelStoreConnectors[index]);
                        index ++;
                    }
                }
                ws.writeLine("return <div>" + panelViews[0] );
                // consolelog this later
                if(panelViews.length>1){
                    var index = 1;
                    while(index<panelViews.length){
                        ws.writeLine(panelViews[index]);
                        index ++;
                    }
                }
                ws.writeLine(__ClassFooter__);
            });
        } else {
            throw 'Page Name Missing';
        }
    });
    // Create main.js , the router and main entrance of the app
    fsPath.writeFile(path + '/Main.js', '// Root File for The Tree Flow app', function (err, data) {
        if (err) throw err;
        console.log('Tree Flow Application Entrance Created');
        var ws = fs.createWriteStream(path + '/Main.js', {flags: 'a'});
        ws.writeLine = (str)=> {
            ws.write('\n');
            ws.write(str);
        };
        ws.writeLine(__MainFileDependencies__);
        ws.writeLine(storeNames.map((e,idx)=>{
            return __StoreImport(storeDirectories[idx],e);
        }).join(';'));
        ws.writeLine(pageNames.map(e=>{
            return "import "+e+" from "+ "'./"+e+'\'';
        }).join(';'));
        ws.writeLine(__RouterHistorySetup__);
        ws.writeLine(__RoutingStores(storeNames));
        ws.writeLine(__MainAppView(pageRoutes,pageNames));
    });
}

// Static Asset for Code Generation utils for Pages
// @todo currently unreadable and very ugly, find a better way to code these lines
const __PageDirectory = (pageName, path) => {return path+'/'+pageName.replace(/\s/g, '')};
const __RootFileName = (pageName,path) => {return __PageDirectory(pageName,path)+'/index.js'};
const __RootFileDependencies__ = "import React from 'react';\
import {inject, observer} from 'mobx-react';\
import {Panel, FormSet, NavBar, FixTable, Controller, Terminal} from 'Components';\
import io from 'socket.io-client';\
import Echarts from 'Echarts/Echarts';"
const __StoreInjection = (storeNames) => {
    return "@inject(\""+storeNames.map(e=>e+'').join('\",\"')+"\")\n@observer"
};
const __ClassHeader = (pageName) => {return "export default class "+pageName+" extends React.Component {"};
const __ClassFooter__ = "</div>}\n};"

// Static Asset for Code Generation utils For Main.js
const __MainFileDependencies__ = "import React from 'react';\
// Import boilerplates\n\
import ReactDOM from 'react-dom';\
import createBrowserHistory from 'history/createBrowserHistory';\
import { Provider } from 'mobx-react';\
import { BrowserRouter as Router, Route , hashHistory} from 'react-router-dom';\
import { RouterStore, syncHistoryWithStore } from 'mobx-react-router';\
import {NavBar} from 'Components';\
const app = document.getElementById('app');\
// Import Mobx Stores :";

//
const __StoreImport = (storeDirectory, storeName) => {
    return "import "+storeName+" from '"+storeDirectory+"';"
}

//
const __RouterHistorySetup__ = "const browserHistory = createBrowserHistory();\
const RoutingStore = new RouterStore();";

// Generate stores to inject
const __RoutingStores = (storeNames)=>{
    return "var stores = {RoutingStore,"+storeNames.map(e=>{return e+""}).toString()+"};";
};

// Generate Mobx Provider and React Routers
const __MainAppView = (pageRoutes,pageNames) =>{
    return "var routes = ["+
        pageRoutes.map((route,idx)=>{
            return "{dispLabel: '"+pageNames[idx]+"', route:'"+route+"'},"
        }).join(',')
        +"];\
    ReactDOM.render(\
    <Provider {...stores}><Router history={browserHistory}><div><NavBar routes={routes}/>"+
        pageRoutes.map((route,idx)=>{
                        return "<Route path=\'"+route+"\' component={"+pageNames[idx]+"}/>";
                    }).join('\n')+ "</div></Router></Provider>, app)"
};


// Check if a word has been collected in the array
// return the number of times it has been appeared in the array, both in substring and string cases
const __ExistsInArray = ((array, wordToCheck)=>{
    var count = 0;
    for (var i = 0; i < array.length; i++) {
        if (array[i].indexOf(wordToCheck) >= 0) count++;
    }
    if (count == 0) return '';
    else return count+'';
});