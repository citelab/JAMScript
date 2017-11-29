var terminal = require('terminal-kit').terminal;
var pkg = require('./package.json');

function terminate()
{
	console.log("Terminating")
	terminal.grabInput( false ) ;
	setTimeout( function() { process.exit() } , 100 ) ;
}

terminal( 'Hello world!\n' );
terminal.grabInput();

terminal.on( 'key' , function( name , matches , data ) {
	console.log( "'key' event:" , name ) ;
	if ( name === 'CTRL_C' ) {terminate() ; }
} ) ;

setInterval(function() {
	console.log('Ping return ', pingTerm());
}, 1000);
