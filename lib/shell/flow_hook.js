/**
 * Created by Richboy on 10/08/17.
 */

'use strict';

var Hook = require('./hook.js');
var Flow = require('richflow').Flow;

class FlowHook extends Hook{
    constructor(opts){
        super(opts);

        this.prompt = "flow> ";
        this.trigger = ";";
    }

    execute(code){
        console.log();
        try {
            eval(code.replaceAll("terminal.", "this.terminal."));

            if( code.indexOf("terminal.") >= 0 )
                console.log();
        }
        catch(e){
            this.terminal.red(e);
            console.log();
        }
    }
}

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

module.exports = FlowHook;