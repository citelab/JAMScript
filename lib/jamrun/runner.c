#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <stdlib.h>

#define MAX_FILE  256

int is_c_file(char * token){
  int len = strlen(token);
  if(len <= 2)
    return 0;
  return token[len - 2] == '.' && token[len - 1] == 'c';
}

int is_js_file(char * token){
  int len = strlen(token);
  if(len <= 3)
    return 0;
  return token[len - 3] == '.' && token[len - 2] == 'j' && token[len - 1] == 's';
}

typedef struct{
  char c_file[MAX_FILE][MAX_FILE];
  char js_file[MAX_FILE][MAX_FILE];
  int num_c_file;
  int num_js_file;
}jam_file;

jam_file *init_jam_file(){
  jam_file *ret = calloc(1, sizeof(jam_file));
  ret->num_c_file = 0;
  ret->num_js_file = 0;
  return ret;
}

void run_c_node(jam_file *js_file){
  int pid;
  char buf[MAX_FILE];
  for(int i = 0; i < js_file->num_c_file; i++){
    pid = fork();
    if(pid == 0){
      sprintf(buf, "./%s", js_file->c_file[i]);
      system(buf);
      exit(0);
    }
  }
}

void run_js_node(jam_file *js_file){
  int pid;
  char buf[MAX_FILE];
  for(int i = 0; i < js_file->num_js_file; i++){
    pid = fork();
    if(pid == 0){
      sprintf(buf, "node %s", js_file->js_file[i]);
      system(buf);
      exit(0);
    }
  }
}

//-o for name of output
//-debug for debugging
//*.c for c nodes
//*.js for j nodes
//-jfirst, prioritize j nodes first
//-cfirst, prioritize c nodes first
//--cflags, Any flags after this is considered for the c compiler
int main(int argc, char ** args){
    int debug_flag = 0;
    int cfirst = 1;

    // char outname[256];
    // char cfile[256];
    // char jsfile[256];
    // char cflags[1024];
    // int debug_flag = 0;
    // int cfirst = 1;
    jam_file *runner = init_jam_file();
    for(int i = 1; i < argc; i++){
      if(is_js_file(args[i])){
        sprintf(runner->js_file[runner->num_js_file++], "%s", args[i]);
        printf("TRUE... \n");
      }
      else if(strcmp("-debug", args[i]) == 0)
        debug_flag = 1;
      else if(strcmp("-jfirst", args[i]) == 0){
        cfirst = 0;
      }else if(strcmp("-cfirst", args[i]) == 0){
        cfirst = 1;
      }else{
        sprintf(runner->c_file[runner->num_c_file++],"%s", args[i]);
      }

      //Now time for the fork bomb
      if(cfirst){
        run_c_node(runner);
        run_js_node(runner);
      }else{
        run_js_node(runner);
        run_c_node(runner);
      }
    }
    free(runner);
    while(1){
      sleep(5);
    }
    //So at this point, we need to compile the c file....
}
