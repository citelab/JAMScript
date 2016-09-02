#include "jam.h"
#include "jdata.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

jamstate_t *js;

void msg_rcv_custom(void *act, void *arg){
  jbroadcaster *x = (jbroadcaster *)arg;
  printf("%s = %s\n", (char *)x->key, (char *)x->data);
}

void stuff(void *act, void *arg){
  command_t *cmd = (command_t *)arg;
  jbroadcaster *x = (jbroadcaster *)cmd->args[0].val.nval;
  printf("Result: %s\n", (char *)get_jbroadcaster_value(x));
}

void hello(void *act, void *arg){
  command_t *cmd = (command_t *)arg;
  printf("%s %s %s\n", cmd->args[0].val.sval, cmd->args[1].val.sval, cmd->args[2].val.sval);

  free_rtable_entry(find_table_entry(js->rtable, cmd), js->rtable);
}

void hello_sync(void *act, void *arg){
  command_t *cmd = (command_t *)arg;
  printf("%s %s %s\n", cmd->args[0].val.sval, cmd->args[1].val.sval, cmd->args[2].val.sval);
  activity_complete(js->atable, "s", "666");
}

void jam_run_app(void *arg){
  jamstate_t *js = arg;
  printf("God Dammit \n");
  arg_t *res = jam_rexec_sync(js, "hello", "s", "oiii");  
  printf("Result: %s\n",  res->val.sval);
  command_arg_free(res);
  jam_rexec_async(js, "hello", "s", "oiii");  
  //jdata_get_server_ip(arg);
  /*
  jshuffler *j = jshuffler_init(0, "Life", NULL);
  jshuffler_push(j, "First run ...");
  sleep(1);
  jshuffler_poll(j);
  sleep(1);
  jshuffler_poll(j);
  jshuffler_push(j, "Second run ...");
  */
  /*
  arg_t *res = jam_rexec_sync(js, "hello", "s", "oiii");  
  printf("Result: %s\n",  res->val.sval);
  command_arg_free(res);
  jam_rexec_async(js, "hello", "s", "oiii");  
  printf("Result: %s\n",  res->val.sval);
  command_arg_free(res);

  jbroadcaster *value = jbroadcaster_init(JBROADCAST_INT, "value", stuff);
  jdata_log_to_server("value", "heeeeeeeey", NULL);
  */
  printf("Hey ... \n");
}

void taskmain(int argc, char **argv)
{
    js = jam_init();
    // Start the event loop in another thread.. with cooperative threads.. we
    // to yield for that thread to start running
    taskcreate(jam_event_loop, js, STACKSIZE);

    // create the application runner
    taskcreate(jam_run_app, js, STACKSIZE);
    activity_regcallback(js->atable, "hello", ASYNC, "sss", hello);
    activity_regcallback(js->atable, "hello_sync", SYNC, "sss", hello_sync);
    printf("Commencing JAM operation \n");
}
