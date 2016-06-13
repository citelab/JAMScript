#include "jam.h"
#include "command.h"
#include <time.h>
#include <stdlib.h>
#include <unistd.h>

int current_status = 1;
void custom_sleep(int time){
  struct timespec tp;
  clock_gettime(CLOCK_MONOTONIC, &tp);
  int start = tp.tv_sec;
  while(start + time > tp.tv_sec)
    clock_gettime(CLOCK_MONOTONIC, &tp);
}

//Current Problem with this is that Time out is kind of annoying because JAMlib doesn't deal with it yet
void jam_run_app(void *arg)
{
    jamstate_t *js = (jamstate_t *)arg;
    int count = 1;
    int temperature = 20;
    char status_msg[256];
    time_t t = time(&t);
    srand((unsigned) time(&t));
    while(count++){
      temperature += (rand()%100 - 50)/10;
      printf("\n---------------STATUS %d ----------------\n", count);
      printf("\n---------------Condition %d----------------\n", current_status);
      printf("Current Temperature %d\n", temperature);
      sprintf(status_msg, "Normal");
      jam_rexec_async(js, "temp_report", "si", status_msg, temperature);
      if(temperature > 25){
        printf("Command AC ON\n");
        sprintf(status_msg, "Temperature High....\nCommand AC turn on.... \n");
        arg_t *res = jam_rexec_sync(js, "temp_action", "si", status_msg, 0);
        command_arg_free(res);
        printf("---------------Status Sent---------------\n\n");
      }else if(temperature < 10){
        printf("Command HEATING ON\n");
        sprintf(status_msg, "Temperature Low....\nCommand Heater turn on.... \n");
        arg_t *res = jam_rexec_sync(js, "temp_action", "si", status_msg, 1);
        command_arg_free(res);
        printf("---------------Status Sent---------------\n\n");
      }else{
        printf("Command OFF\n");
        sprintf(status_msg, "Temperature Reasonable....\nCommand Temperature Control off.... \n");
        arg_t *res = jam_rexec_sync(js, "temp_action", "si", status_msg, 2);
        command_arg_free(res);
        printf("---------------Status Sent---------------\n\n");
      }
      sleep(1);
    }

    //We will be sending a message to another C node, asynchronously
}

void get_temp_status(char *name, char *status_msg, int status)
{
    printf("Obtaining Current Status .... \n");
    printf("\n");
}


void callget_temp_status(void *act, void *arg)
{
    command_t *cmd = (command_t *)arg;
    get_temp_status(cmd->args[0].val.sval, cmd->args[1].val.sval,  cmd->args[2].val.ival);
}

void set_temp_control(char * name, char *status_msg, int status)
{
    printf("Setting Current Status .... \n");
    current_status = status;
    printf("\n");
}


void callset_temp_control(void *act, void *arg)
{
    command_t *cmd = (command_t *)arg;
    set_temp_control(cmd->args[0].val.sval, cmd->args[1].val.sval,  cmd->args[2].val.ival);
}

void hellofk(char *s, int x, char *e)
{
    printf("This is Hello from FK function \n");
    printf("Here is the first string: %s, and last string: %s, \nAnd integer: %d\n", s, e, x);
    printf("\n");
}


void callhellofk(void *act, void *arg)
{
    command_t *cmd = (command_t *)arg;
    hellofk(cmd->args[0].val.sval, cmd->args[1].val.ival, cmd->args[2].val.sval);
}


void taskmain(int argc, char **argv)
{
    jamstate_t *js = jam_init();

    // Start the event loop in another thread.. with cooperative threads.. we
    // to yield for that thread to start running
    taskcreate(jam_event_loop, js, STACKSIZE);
    activity_regcallback(js->atable, "set_temp_control", SYNC, "ssi", callset_temp_control);
    activity_regcallback(js->atable, "get_temp_status", ASYNC, "ssi", callget_temp_status);
    activity_regcallback(js->atable, "hellofk", ASYNC, "sis", callhellofk);

    // create the application runner
    taskcreate(jam_run_app, js, STACKSIZE);
    printf("Commencing JAM operation \n");
}
