#include "jam.h"
#include "command.h"
#include <stdio.h>
#include <string.h>
#include "task.h"
/*
//in your case: eval("var fn = " + fnStr);
eval("var fn = function(){ blah1;blah2;blah3; }");
fn();
*/
char *read_file(char * file_path){
  FILE * file_hand = fopen(file_path, "r");
  char *buf;
  long length;
  if(file_hand == NULL){
    perror("Error: ");
    exit(1);
  }
  fseek (file_hand, 0, SEEK_END);
  length = ftell (file_hand);
  fseek (file_hand, 0, SEEK_SET);
  buf = malloc (length);
  if (buf){
    fread (buf, 1, length, file_hand);
  }
  fclose(file_hand);

  return buf;
}

void jam_run_app(void *arg){
  jamstate_t *js = (jamstate_t *)arg;
  char file_path[256];
  //while(1){
    printf("Enter the JS function filepath: ");
    scanf("%s", file_path);
    fflush(stdin);
    printf("\nFile: %s\n", file_path);
    char *j_program  = read_file(file_path);
    //arg_t *res =
    jam_rexec_async(js, "run_new_j_task", "s", j_program);
    //printf("\n---------------------RESULT--------------------\n: %s\n", res->val.sval);
    //command_arg_free(res);
    free(j_program);
  //}
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
    taskname("mainprogram");
    jamstate_t *js = jam_init();
    // Start the event loop in another thread.. with cooperative threads.. we
    // to yield for that thread to start running
    taskcreate(jam_event_loop, js, STACKSIZE);

    // create the application runner
    taskcreate(jam_run_app, js, STACKSIZE);
    activity_regcallback(js->atable, "hellofk", ASYNC, "sis", callhellofk);

    printf("Commencing JAM operation \n");
}
