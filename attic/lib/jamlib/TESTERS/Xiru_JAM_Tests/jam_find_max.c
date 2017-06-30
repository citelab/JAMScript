#include "jam.h"
#include "command.h"
#include <stdlib.h>
#include <time.h>
#include <unistd.h>

#define MAX_ARR_SIZE  1000000

typedef struct{
  int buf[MAX_ARR_SIZE];
  int length;
}int_buf;

int_buf *generate_array_data(){

  time_t t = time(&t);
  srand((unsigned) time(&t));
  int_buf *ret = (int_buf*)calloc(1, sizeof(int_buf));
  if(ret == NULL){
    perror("INVALID CALLOC\n");
    exit(0);
  }
  ret->length = MAX_ARR_SIZE;
  for(int i = 0; i < ret->length; i++){
    ret->buf[i] = rand();
  }
  return ret;
}

int find_max_index(int_buf *arr){
  int max = 0;
  int ret = 0;
  for(int i = 0; i < arr->length; i++){
    if(max < arr->buf[i]){
      max = arr->buf[i];
      ret = i;
    }
  }

  return ret;
}

void jam_run_app(void *arg)
{
    //Okay so here, we simulate hill climbing and attempt to find the highest value given a large array
    jamstate_t *js = (jamstate_t *)arg;
    int_buf * data;
    int result = 0;
    char status_msg[256];
    int count = 1;
    time_t t;
    time(&t);
    srand((unsigned) time(&t));
    while(count++ < 10){
      printf("---------------Status Sent---------------\n");
      if(rand() % 100 == 0){
        sprintf(status_msg, "ERROR!");
        jam_rexec_async(js, "process_status", "si", status_msg, 1);
        printf("ERROR!\n");
        break;
      }else{
        sprintf(status_msg, "NORMAL! Result from last loop %d", result);
        jam_rexec_async(js, "process_status", "si", status_msg, 0);
        //arg_t *res = jam_rexec_sync(js, "timer", "sii", "f", 1);
        //command_arg_free(res);
        /*
        for(int j = 0; j < 100; j++){
          data = generate_array_data();
          result = data->buf[find_max_index(data)];
          free(data);
        }*/
        sleep(1);
        printf("---------------Result of round %d----------------\n--------------------Result: %d------------------\n\n", count, result);
      }
    }
}



void taskmain(int argc, char **argv)
{
    jamstate_t *js = jam_init();

    // Start the event loop in another thread.. with cooperative threads.. we
    // to yield for that thread to start running
    taskcreate(jam_event_loop, js, STACKSIZE);

    // create the application runner
    taskcreate(jam_run_app, js, STACKSIZE);
    printf("Commencing JAM operation \n");
}
