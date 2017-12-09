/**
 * Created by Richboy on 30/06/17.
 */

//This app will run all the way to the cloud level but several activities will be restricted to certain levels
//This app, at the fog level will share data with the allocator running on the fog.
//This app, at the fog and cloud levels, will share data with the visualizer

jdata{
    stuct spotInfo{
        string label;           //parking label
        int isFree;             //0=occupied, 1=free
        int accessibility;      //0=for all, 1=restricted
        int parkingDuration;
    } spotInfo as logger;
}

//TODO
//For now, This application should listen for notification when a car has left a parking spot. ideally, this sensor
//should automatically detect the occupancy of a parking spot.

//car sends to this sensor that it is leaving the spot and the sensor sends to the spot that it is now free. The spot can then
//log to the manager that it is available

//Question: In a case of multiple files, how does the runtime know which c file to send the method to if we are using
//J2C and there are multiple c files having same function name
//Question: can we send struct in jsync/jasync?

//Question: if there are so many instances of a c-node, how do i find and send to a particular c node

//method call from the car to the sensor
jasync function leaving(spot){

}