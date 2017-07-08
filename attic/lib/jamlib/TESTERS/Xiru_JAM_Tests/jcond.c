#include "jam.h"
#include "duktape/duktape.h"
#include "jcondition.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

//On this side, the jcondition for a specific function is just a string ...
jamstate_t *js;

//Here let's say we have jcondition ...
char *jcond_run_task_thread = "jcondition_context.device_id == 7;";

void run_task_thread(char * usr_name, char * msg){
  if(!jcond_exec_stmt(jcond_run_task_thread)){
    printf("Jcondition Failed ... \n");
    return;
    //If this function was a sync, we would return JCOND_ERROR_MSG;
  }
  char *result;
  duk_context *ctx = duk_create_heap_default();
  printf("Message Received: %s\n", msg);
  duk_eval_string(ctx, msg);
  result = strdup(duk_get_string(ctx, -1));
  printf("result is: %s %s\n", result, js->cstate->conf->device_id);
  arg_t *res = jam_rexec_sync(js, "process_response", "ss", result, js->cstate->conf->device_id);
  if (res->type == STRING_TYPE){
      if(strcmp(res->val.sval, JCOND_ERROR_MSG) == 0){
        jcond_set_error(res->val.sval);
        printf("%s\n", jcond_get_error());
      }
  }
  command_arg_free(res);
  free(result);
  duk_pop(ctx);
  duk_destroy_heap(ctx);
}

void callrun_task_thread(void *act, void *arg){
  command_t *cmd = (command_t *)arg;
  run_task_thread(cmd->args[0].val.sval, cmd->args[1].val.sval);
}

void jam_run_app(void *arg){
  jamstate_t *js = arg;
  jdata_get_server_ip(arg);
  printf("Device ID %s\n", js->cstate->conf->device_id);
}

void taskmain(int argc, char **argv)
{
    js = jam_init();
    // Start the event loop in another thread.. with cooperative threads.. we
    // to yield for that thread to start running
    taskcreate(jam_event_loop, js, STACKSIZE);

    // create the application runner
    //jcond_read_context();
    taskcreate(jam_run_app, js, STACKSIZE);
    activity_regcallback(js->atable, "run_task_thread", ASYNC, "ss", callrun_task_thread);
    printf("Commencing JAM operation \n");
}
