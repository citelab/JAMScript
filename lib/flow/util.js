/**
 * Created by Richboy on 04/07/17.
 */

"use strict";

module.exports = (function(){
    return{
        generateUID(length, caseSense, exempts){
            var elem = "0123456789abcdefghijklmnopqrstuvwxyz";
            var code = "";

            for(var i = 0 ; i < length; i++){
                var r = Math.floor(Math.random() * elem.length);
                var sect = elem.substring(r, r + 1);

                if(caseSense){
                    var r2 = Math.floor(Math.random() * 2);
                    if( r2 == 1 )
                        sect = sect.toUpperCase();
                }

                while( inArray(sect, exempts) ){
                    r = Math.floor(Math.random() * elem.length);
                    sect = elem.substring(r, r + 1);

                    if(caseSense){
                        r2 = Math.floor(Math.random() * 2);
                        if( r2 == 1 )
                            sect = sect.toUpperCase();
                    }
                }
                code += sect;
            }
            return code;
        }
    }
})();