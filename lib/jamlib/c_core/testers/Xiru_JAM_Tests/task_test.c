#include "jam.h"
#include "command.h"
#include <stdio.h>
#include <string.h>

int count_1 = 0;
int count_2 = 0;
void t1(void *args){
  while(1){
    printf("--------HEY-------\n");
    //sleep(2);
    int val = taskyield();
    printf("Task Num %d %d\n", val, count_1++);
  }
}

void t2(void * args){
  while(1){
    printf("--------YES-------\n");
    //sleep(2);
    int val = taskyield();
    printf("Task Num %d %d\n", val, count_2++);
  }
}

void taskmain(){
  jamstate_t *js = jam_init();
  taskcreate(t1, js, STACKSIZE);
  taskcreate(t2, js, STACKSIZE);
}
