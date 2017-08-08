

//TODO
//This application should be able to query for parking spots close to the car's current location
//This application should listen for broadcasts for when free parking spots are available.
//For now we will notify the sensor when this car leaves an occupied parking spot. Ideally the sensor should sense it

//Now when we receive a broadcast, we will simulate an attempt to park by randomly picking a time it will take to drive
//to the spot. We could eliminate this by introducing a synchronous model that will let the car closest to a free spot
//to park

//For simulation, When a car tries to park, we check to see if that spot has been taken by requesting information from
//the fog. If it has been taken, we try the next closest spot until we exhaust all available spots in the broadcast

int main(int argc, char **argv){

}

//this car has received a message from the manager to occupy this slot
jasync occupy(char* slot) {
	//we need to send a message (jasync) to the sensor that this slot has been occupied by this car
}