/**
 * Created by Richboy on 11/08/17.
 */

'use strict';

var Hook = require('./hook.js');

class JViewHook extends Hook{
    constructor(opts){
        super(opts);

        this.prompt = "jview> ";
    }

    execute(code){
        //TODO
    }
}

module.exports = JViewHook;