#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "jam.h"
#include "task.h"

void seek_police(){

}

void seek_parking(){
  printf("Street Name?\n");
  char *buf;
  size_t len = 0;
  getline(&buf, &len, stdin);
}

void seek_restaurant(){

}

int main(){
  char *buf;
  size_t len = 0;
  while(1){
    printf("Command Menu ...\n1. Look for police ahead\n2. Look for parking place on street x\n3. Look for restaurant ahead\n");
    getline(&buf, &len, stdin);
    switch(buf[0]){
        case '1': seek_police(); break;
        case '2': seek_parking(); break;
        case '3': seek_restaurant(); break;
        default: printf("Invalid Command... \n"); break;
    }
    free(buf);
    len = 0;
  }
  return 0;
}
