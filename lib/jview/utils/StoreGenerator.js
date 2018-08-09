const fs = require('fs');
const fsPath = require('fs-path');
const EchartAdaptor = require('./EchartAdaptor');

/*
 @ storeName -> just str.concat(panel,'Store.js')
 @ stores -> stores to be generated
 @ pageDirectory -> stores associated page's directory, which the store files will be saved in as well
 @ callback -> callback function
 */

module.exports = function(storeName, panel, pageDirectory){

    fsPath.writeFile(__StoreFileDir(pageDirectory,storeName), '//Store File for '+storeName, function(err,data){
        if (err) throw err;
        console.log('Store File Created');

        var ws = fs.createWriteStream(__StoreFileDir(pageDirectory,storeName), {flags:'a'});
        ws.writeLine=(str)=>{ws.write('\n');ws.write(str);};
        ws.writeLine(__StoreFileDependencies__);
        ws.writeLine(__ClassName(storeName));

        //write
        ws.writeLine(__BasicFunctions__);
        if (panel.type == 'formset'){
            // map user inputed values , formset is represented by map
            if(panel.store) {
                ws.writeLine("@observable map = " + JSON.stringify(panel.store));
            } else {
                console.log ('Store is missing on panel'+storeName);
                throw err;
            }
            ws.writeLine("@computed get formset(){\n");
            if(panel.formList){
                panel.formList.forEach(e=>{
                    e.trigger = 'changeValue';
                    e.value = panel.store[e.param] ? panel.store[e.param] : 0;
                })
                ws.writeLine("const formList = "+JSON.stringify(panel.formList, null, 4));
            } else {
                console.log ("FormList is missing on a formset panel");
                throw err;
            }
            if(panel.actionList){
                ws.writeLine("const actionList = "+JSON.stringify(panel.actionList, null, 4));
            } else {
                console.log ("FormList is missing on a formset panel");
                throw err;
            }

            ws.writeLine("return {\
                formList: formList,\
                actionList: actionList,\
                className: ' formset2 whiteBgColor',\
                columns: 1\
            }")
            ws.writeLine("}")
        } else if (panel.type  == 'table') {
            // map user inputed values , table is represented by array
            if(panel.store) {
                ws.writeLine("@observable array = " + JSON.stringify(panel.store));
            } else {
                console.log ('Store is missing on panel'+storeName);
                throw err;
            }
            // form header based on headers definition in the Config.json
            ws.writeLine("@computed get table(){\n");
            ws.writeLine("const headers = "+JSON.stringify(panel.headers));
            ws.writeLine("var centerBody = this.array.map(entry => {\
                                return (entry.map(e=>{\
                                        return {type:'plain', valueLabel: e};\
                                    }));\
                                }).map(e=>{return {className: '',list: e};});");
            ws.writeLine("var arrayOfCheckBoxes =this.array.map(e=>{\
            return({\
                className: '',\
                list: [{type: 'checkbox', param: 1, value: false, trigger: 'setCheckBox', className: 'td-text-center'}]\
            });});");
            // return the render ready obj data
            ws.writeLine("return {\
                leftHeader: [{type: 'checkbox', value: false, trigger: 'selectAll', className: 'td-text-center'}],\
                leftBody: arrayOfCheckBoxes,\
                rightHeader: [],\
                centerHeader: headers,\
                rightBody: [],\
                centerBody: centerBody}");
            ws.writeLine('}');
        } else if(panel.type == 'scatter') {
            // initialize an empty array so that when socket.io emits messages in, it will store the data in the array
            ws.writeLine("@observable array = [[],[]];");
            // form  based on headers definition in the Config.json
            ws.writeLine("@computed get scatter"+EchartAdaptor.scatter.toString().replace('function',''));
            ws.writeLine("addDataPoints (x,y,gateIndex){\
                for (var i = 0; i < gateIndex - this.array.length + 1; i++) {this.array.push([]);}\
                this.array[gateIndex].push([x,y])};\n\
                setArray(array,gateIndex){\
                for (var i = 0; i < gateIndex - this.array.length + 1; i++) {\
                this.array.push([]);\
            }\
            this.array[gateIndex]=array;\
            };");
        } else if(panel.type == 'pie') {
            // initialize an empty array so that when socket.io emits messages in, it will store the data in the array
            ws.writeLine("@observable array = [[],[]];");
            // form  based on headers definition in the Config.json
            ws.writeLine("@computed get pie"+EchartAdaptor.pie.toString().replace('function',''));
            ws.writeLine("addDataPoints (x,y,gateIndex){\
                for (var i = 0; i < gateIndex - this.array.length + 1; i++) {this.array.push([]);}\
                this.array[gateIndex].push([x,y])};\n\
                setArray(array,gateIndex){\
                for (var i = 0; i < gateIndex - this.array.length + 1; i++) {\
                this.array.push([]);\
            }\
            this.array[gateIndex]=array;\
            };");
        } else if(panel.type == 'graph' || panel.type == 'stackedgraph' ) {
            // initialize an empty array so that when socket.io emits messages in, it will store the data in the array
            ws.writeLine("@observable array = [[],[]];");
            // form  based on headers definition in the Config.json
            if (panel.type =='graph') {
                ws.writeLine("@computed get graph" + EchartAdaptor.graph.toString().replace('function', ''));
            } else {
                ws.writeLine("@computed get stackedGraph" + EchartAdaptor.stackedGraph.toString().replace('function', ''));
            }
            ws.writeLine("addDataPoints (x,y,gateIndex){\
                for (var i = 0; i < gateIndex - this.array.length + 1; i++) {this.array.push([]);}\
                this.array[gateIndex].push([x,y])};\n\
                setArray(array,gateIndex){\
                for (var i = 0; i < gateIndex - this.array.length + 1; i++) {\
                this.array.push([]);\
            }\
            this.array[gateIndex]=array;\
            };");
        } else if(panel.type == 'controller') {
            // map user inputed values , formset is represented by map
            if(panel.store) {
                ws.writeLine("@observable map = " + JSON.stringify(panel.store));
            } else {
                console.log ('Store is missing on panel'+storeName);
                throw err;
            }

            ws.writeLine("@computed get controller(){\n");
            ws.writeLine("const controlList = [");
            if(panel.controlList){
                panel.controlList.forEach((e, idx)=>{
                    if (e.type=== "slider") {
                        ws.writeLine("{")
                        ws.writeLine('  "id": "' + e.id + '",')
                        ws.writeLine('  "type": "' + e.type + '",')
                        ws.writeLine('  "dispLabel": "' + e.dispLabel + '",')
                        ws.writeLine('  "max": this.map["' + e.max + '"],')
                        ws.writeLine('  "min": this.map["' + e.min + '"],')
                        ws.writeLine('  "step": this.map["' + e.step + '"],')
                        ws.writeLine('  "value": this.map["' + e.value + '"],')
                        ws.writeLine('  "trigger": "' + e.trigger + '",')
                        ws.writeLine('  "valueName": "' + e.valueName + '",')
                        ws.writeLine('  "mode": "' + e.mode + '",')
                        ws.writeLine('  "interval": "' + e.interval + '",')
                        ws.writeLine("}")
                    } else if (e.type === "button") {
                        //ws.writeLine(JSON.stringify(e, null, 4));
                        ws.writeLine("{")
                        ws.writeLine('  "id": "' + e.id + '",')
                        ws.writeLine('  "type": "' + e.type + '",')
                        ws.writeLine('  "dispLabel": "' + e.dispLabel + '",')
                        ws.writeLine('  "value": this.map["' + e.value + '"],')
                        ws.writeLine('  "className": "' + e.className + '",')
                        if (e.trigger.startsWith("/Function(") && e.trigger.endsWith(")/")) {
                            ws.writeLine('  "trigger": ' + e.trigger.substring(10, e.trigger.length - 2) + ',')
                        } else {
                            ws.writeLine('  "trigger": "' + e.trigger + '",')
                        }
                        ws.writeLine('  "valueName": "' + e.valueName + '",')
                        ws.writeLine('  "mode": "' + e.mode + '",')
                        ws.writeLine('  "disabled": this.map["' + e.disabled + '"],')
                        ws.writeLine('  "interval": "' + e.interval + '",')
                        ws.writeLine("}")
                    } else if (e.type === "terminal") {
                        ws.writeLine("{")
                        ws.writeLine('  "id": "' + e.id + '",')
                        ws.writeLine('  "type": "' + e.type + '",')
                        ws.writeLine('  "dispLabel": "' + e.dispLabel + '",')
                        ws.writeLine('  "commandsListName": "' + e.commandsList + '",')
                        ws.writeLine('  "commands": this.map["' + e.commandsList + '"],')
                        ws.writeLine('  "className": "' + e.className + '",')
                        ws.writeLine('  "trigger": "' + e.trigger + '",')
                        ws.writeLine('  "buttonTrigger": "' + e.buttonTrigger + '",')
                        ws.writeLine('  "buttonLabel": "' + e.buttonLabel + '",')
                        ws.writeLine("}")
                    } else if (e.type === "multiStateButton") {
                        ws.writeLine("{")
                        ws.writeLine('  "id": "' + e.id + '",')
                        ws.writeLine('  "type": "' + e.type + '",')
                        ws.writeLine('  "dispLabel": "' + e.dispLabel + '",')
                        ws.writeLine('  "trigger": "' + e.trigger + '",')
                        ws.writeLine('  "className": "' + e.className + '",')
                        ws.writeLine('  "states": ' + JSON.stringify(e.states) + ',')
                        ws.writeLine('  "state": this.map["' + e.state + '"],')
                        ws.writeLine('  "onStatus": this.map["' + e.onStatus + '"],')
                        ws.writeLine('  "onStatusName": "' + e.onStatus + '",')
                        ws.writeLine('  "mode": "' + e.mode + '",')
                        ws.writeLine('  "interval": "' + e.interval + '",')
                        ws.writeLine("}")
                    }

                    if (panel.controlList.length > 1 && idx < panel.controlList.length - 1) {
                        ws.writeLine(",")
                    }
                })
            } else {
                console.log ("ControlList is missing on a controller panel");
                throw err;
            }

            ws.writeLine("]")

            ws.writeLine("return {\
                controlList: controlList,\
                columns: 1\
            }")
            ws.writeLine("}")
        }
        ws.writeLine(__ClassFooter(storeName));
    });
}

const __StoreFileDir = (pageDirectory,storeName) => {return pageDirectory+'/'+storeName+'.js'};
const __ClassName = (storeName) => {return "class "+storeName+"{"};
const __ClassFooter = (storeName) => {return "}\
var store = window.store = new " + storeName +";\
export default store"
}

const __StoreFileDependencies__ = "import { autorun, observable, computed} from 'mobx';"

const __BasicFunctions__ = "reset(){this.map=this.map.map(e=>{return 0})}\
changeValue(value,param){this.map[param]=value;}\
addCommand(command, commandListName){this.map[commandListName].push(command)}"
