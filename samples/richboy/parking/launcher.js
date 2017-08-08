/**
 * Created by Richboy on 27/07/17.
 *
 * this file launches all parts of the application.
 */

var cp = require('child_process');
const SPOTS = 10;
const CARS = 15;
const APP = "parking";

//launch the parking manager

//launch the spots
for( let i = 0; i < SPOTS; i++ ){
    let terminal = cp.spawn('bash');
    terminal.stdin.write("./a.out -a "+ APP +" -n "+ (i + 1) +"\n");
}

//launch the cars


