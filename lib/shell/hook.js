/**
 * Created by Richboy on 10/08/17.
 */

'use strict';

var camelCase = require('camelcase');

/**
 * This class defines common methods for hooking onto the shell app
 */
class Hook{
    /**
     *
     * @param opts The option settings
     */
    constructor(opts){
        this.prompt = "App> ";  //the prompt text
        this.terminal = opts.terminal; //The reference to the terminal library
        this.trigger = "\n";   //the trigger character that causes code execution
        this.args = opts.args;
        this.parser = opts.parser;  //A yargs-parser object which can be optionally used to parse the code
    }

    /**
     * This requests a list of command sequence to be used for auto complete
     * e.g ["sudo", "sudo flow", "sudo flow test"]
     * @returns {Array} the array list of command sequences
     */
    getAutoCompleteData(){
        return [];
    }

    /**
     * This cab be used for colouring the contents which will be typed by the user
     * See usage from the tokenHook option of:
     * https://github.com/cronvel/terminal-kit/blob/HEAD/doc/high-level.md#ref.inputField
     * @param token
     * @param isEndOfInput
     * @param previousTokens
     * @param terminal
     * @param config
     */
    tokenizer(token , isEndOfInput , previousTokens , terminal , config){
    }

    /**
     * This method is called whenever the trigger text is encountered
     * @param code the code to execute
     */
    execute(code){}

    /**
     * this method will be called whenever the process is about to quit
     * for the hook to do some housekeeping
     */
    disconnect(){}

    /**
     * This method converts the build object for displaying the help
     * @param obj the build object
     */
    printHelp(obj){
        console.log();
        this.terminal.green("Usage: %s [options]\n", obj.cmd ? obj.cmd : "");
        if( obj.desc ){
            this.terminal.brightBlack("\t%s\n", obj.desc);
        }
        if( obj.opts && obj.opts.length > 0 ){
            this.terminal.black("\nOptions:\n");
            let opt;
            for( let i = 0; i < obj.opts.length; i++ ){
                opt = obj.opts[i];
                if( !opt.cmd )
                    continue;

                this.terminal.green("%s\t%s\n", opt.cmd, opt.desc ? opt.desc : "");
            }
        }
    }

    /**
     * Used to parse a build object with the code and argument structure
     * @param obj the build object
     * @returns {*} the parsed object
     */
    parse(obj){
        var opts = {alias: {}};

        //get the option aliases
        if( obj.opts && obj.opts.length > 0 ){
            let opt, cmdParts, dbl, sgl;
            for( let i = 0; i < obj.opts.length; i++ ) {
                opt = obj.opts[i];
                if (!opt.cmd)
                    continue;

                cmdParts = opt.cmd.replaceAll(", ", " ").replaceAll(",", " ").split(/\s+/);
                dbl = cmdParts.filter(p => p.trim().substring(0, 2) == "--");
                sgl = cmdParts.filter(p => dbl.indexOf(p.trim()) < 0 && p.trim().substring(0, 1) == "-");
                if( dbl.length > 0 && sgl.length > 0 ) {
                    dbl = dbl.map(p => p.substring(2, p.length));
                    sgl = sgl.map(p => p.substring(1, p.length));

                    opts.alias[dbl[0]] = sgl.concat(dbl.length > 1 ? dbl.slice(1) : []);
                }
            }
        }

        opts.number = obj.number || [];
        opts.boolean = obj.boolean || [];
        opts.string = obj.string || [];
        var types = {number: opts.number, boolean: opts.boolean, string: opts.string};

        //parse the code
        var parsed = this.parser(obj.code, opts);

        //build the command arguments...the arguments after the main command that are not options
        var cmdArgs = obj.cmd.match(/(<[a-zA-Z]+[a-zA-Z0-9_]*>)/g);
        var pos = 1;
        for( let cmdArg of cmdArgs ){
            cmdArg = camelCase(cmdArg);//cmdArg.substring(1, cmdArg.length - 1)
            if( parsed[cmdArg] )
                throw new Error("Duplicate: Command argument '%s' name conflicts with another or some option", cmdArg);
            parsed[cmdArg] = pos < parsed._.length ? parseType(cmdArg, parsed._[pos++], types) : null;
        }

        //check if command was used in options or in command arguments
        if( parsed.command )
            throw new Error("`command` argument is reserved!");

        //set the name of this command in the command property
        parsed.command = parsed._[0];

        //delete the _ array from the object cause its no longer needed
        delete parsed._;

        return parsed;
    }
}

function parseType(key, text, types){
    let type = "string";

    if( types.number.indexOf(key) >= 0 )
        type = "number";
    if( types.boolean.indexOf(key) >= 0 )
        type = "boolean";

    switch(type){
        case "number":
            try{
                return Number(text);
            }
            catch(e){
                return 0;
            }
            break;
        case "boolean":
            return Boolean(text);
        default:
            return String(text);
    }
}

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

module.exports = Hook;