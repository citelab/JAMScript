#include <time.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>

#define MAX_NAME 256
#define DEVICE_TYPE 6

char device_id[MAX_NAME];
int device_type;
int status;
jamstate_t *js;

enum{
  PHONE,
  WATCH,
  CAR,
  LAPTOP,
  DESKTOP,
  EMBEDDED
};

jasync report_device(char * device_id, char * status_msg){
  var a;
  for(var i = 0; i < registered_device.length; i++){
    if(registered_device[i].name.localeCompare(device_id)){
      registered_device[i].status = 0;
      work_sent.splice(i, 1);
      break;
    }
  }
  console.log("Device " + device_id + " just reported " + status_msg);
}


jsync int setup() {
  var a;
  ID_GENERATOR = 0;
  registered_device = [];
  work_sent = [];
  d = new Date();

  setTimeout(update_device_list, 10000);
  setTimeout(generate_sync_work, 3000);
  setTimeout(generate_async_work, 5000);
  return 0;
}

jasync alive(char * device){
  if(rand()%2 == 0){
    printf("\n---------------------------------------\nDevice %s is alive\n", device_id);
    report_device(device_id, "All Good");
    status = 0;
  } else {
    printf("This device is not responding... \n");
    status = 1;
  }
}

jasync update_device_list(){
  var a;
  for(var i = 0; i < registered_device.length; i++){
    if(registered_device[i].status >= 3){
      console.log("Device " + registered_device[i].name + " is dead ... ");
      registered_device[i].status++;
    }
  }
  console.log("Current Work Status: %o", work_sent);
  console.log("Checking Status Of Devices ...");
  alive("STILL ALIVE?");
  setTimeout(update_device_list , 4000);
}

jasync generate_async_work(){
  var type = parseInt(Math.random() * 6, 10);
  var device_list = "";
  for(var i = 0; i < registered_device.length; i++){
    if(registered_device[i].type == type && registered_device[i].status <= 2){
      device_list += registered_device[i].name + "/";
      work_sent.push({"device_id":registered_device[i].name, "timestamp": d.getTime()});
    }
  }
  console.log("Sending Work Request to " + device_list);
  workasync(device_list);
  setTimeout(generate_async_work, 15000);
}

jasync generate_sync_work(){
  var type = parseInt(Math.random() * 6, 10);
  for(var i = 0; i < registered_device.length; i++){
    if(registered_device[i].type == type && registered_device[i].status <= 2){
      console.log("Attempting Sync Work... ")
      var result = worksync("Syncing");
      console.log("Result is ... " + result);
    }
  }
  setTimeout(generate_sync_work, 60000);
}


jasync report_device_work(char * device_id, char * status_msg){
  var a;
  for(var i = 0; i < registered_device.length; i++){
    if(registered_device[i].name.localeCompare(device_id)){
      registered_device[i].status = 0;
      break;
    }
  }
  console.log("Device " + device_id + " just reported " + status_msg);
}


jasync workasync(char * device_list){
  printf("Device_list: %s\n", device_list);
  if(strstr(device_list, device_id)){
    if(status){
      printf("\n--------This device is not responding... ---------\n\n");
    }else{
      printf("\n----------------------------------\nDevice %s is doing work\n------------------------------\n\n", device_id);
      report_device_work(device_id, "Work is finished");
    }
  }
}

jsync char * worksync(char * device_list){
  printf("Device_list: %s\n", device_list);
  if(strstr(device_list, device_id)){
    if(status){
      printf("\n--------This device is not responding... ---------\n\n");
    }else{
      printf("\n----------------------------------\nDevice %s is doing work\n------------------------------\n\n", device_id);
    }
  }
  return "work completed";
}

jsync char * register_device(char * device_type, char * status_msg, int type){
  var a;
  console.log(status_msg);
  registered_device.push({"name":device_type + "-" + ID_GENERATOR, "status":0, "type":type});
  console.log("Device " + registered_device[ID_GENERATOR].name + " has been registered");
  return registered_device[ID_GENERATOR++].name;
}





void generate_name(char * prefix){
  sprintf(device_id, "%s", register_device(prefix, "Registering device... ", device_type));
}

void generate_device(){
  device_type = rand()%6;
  switch(device_type){
    case PHONE: generate_name("PHONE");
                break;
    case WATCH: generate_name("WATCH");
                break;
    case CAR: generate_name("CAR");
                break;
    case LAPTOP: generate_name("LAPTOP");
                break;
    case DESKTOP: generate_name("DESKTOP");
                break;
    case EMBEDDED: generate_name("EMBEDDED");
                break;
  }
  status = 0;

}

int main() {
  srand(time(NULL) % getpid() * getpid());
  setup();
  generate_device();
  return 0;
}

