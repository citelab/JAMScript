#include "jam.h"
#include "command.h"
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

void generate_name(char *prefix){
  arg_t *res = jam_rexec_sync(js, "register_device", "ssi", prefix, "Registering device... ", device_type);
  sprintf(device_id, "%s", res->val.sval);
  command_arg_free(res);
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

void jam_run_app(void *arg){
  generate_device();
}

void alive(char *device){
      if(rand()%2 == 0){
        printf("\n---------------------------------------\nDevice %s is alive\n", device_id);
        jam_rexec_async(js, "report_device", "ss",device_id, "All Good");
        status = 0;
      }else{
        printf("Device %s is not responding... \n", device_id);
        status = 1;
      }
}


void callalive(void *act, void *arg)
{
    command_t *cmd = (command_t *)arg;
    alive(cmd->args[0].val.sval);
}

void workasync(char * device_list){
  printf("Device_list: %s\n", device_list);
  if(strstr(device_list, device_id)){
    if(status){
      printf("\n--------Device %s is not responding... ---------\n\n", device_id);
    }else{
      printf("\n----------------------------------\nDevice %s is doing work\n------------------------------\n\n", device_id);
      jam_rexec_async(js, "report_device_work", "ss",device_id, "Work is finished");
    }
  }
}

void callworkasync(void *act, void *arg){
  command_t *cmd = (command_t *)arg;
  workasync(cmd->args[0].val.sval);
}


void worksync(char * device_list){
  printf("Device_list: %s\n", device_list);
  if(strstr(device_list, device_id)){
    if(status){
      printf("\n--------Device %s is not responding... ---------\n\n", device_id);
    }else{
      printf("\n----------------------------------\nDevice %s is doing work\n------------------------------\n\n", device_id);
    }
  }
}

void callworksync(void *act, void *arg){
  command_t *cmd = (command_t *)arg;
  worksync(cmd->args[0].val.sval);
  activity_complete(js->atable, "s", "work completed");
}

void taskmain(int argc, char **argv)
{
    for(int i = 0; i < 4; i++){
      fork();
    }
    srand(time(NULL) % getpid() * getpid());
    js = jam_init();
    // Start the event loop in another thread.. with cooperative threads.. we
    // to yield for that thread to start running
    taskcreate(jam_event_loop, js, STACKSIZE);

    // create the application runner
    taskcreate(jam_run_app, js, STACKSIZE);
    activity_regcallback(js->atable, "alive", ASYNC, "s", callalive);
    activity_regcallback(js->atable, "workasync", ASYNC, "s", callworkasync);
    activity_regcallback(js->atable, "worksync", SYNC, "s", callworksync);

    printf("Commencing JAM operation \n");
}
