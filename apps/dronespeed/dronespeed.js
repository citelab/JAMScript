/*Sample Demo Program*/

function displayDroneSpeed() {
	var speed = getDroneSpeed();
	console.log('Drone speed:', speed);
}

setInterval(function() {
        displayDroneSpeed();
}, 3000);