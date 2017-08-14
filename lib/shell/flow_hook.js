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
        this.banner = "Flows.js";
        this.bannerColor = "magenta";
        this.program = "";
    }

    execute(code){
        if( code == "clear;" ) {
            this.program = "";
            console.log();
            console.log("Cleared.");
            return;
        }
        else if( code != "run;" ) {
            this.program += "\n" + code;
            console.log();
            return;
        }

        console.log();
        try {
            eval(this.program.replaceAll("terminal.", "this.terminal."));

            if( this.program.indexOf("terminal.") >= 0 )
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