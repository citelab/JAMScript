#include "jcondition.h"

int jcond_error;
char jcond_err_msg[256];
char *jcond_stmt = NULL;
duk_context *ctx = NULL;

void refresh_jcondition(){
  free(jcond_stmt);
  jcond_read_context();
  jcond_init_duktape();
}

void jcond_read_context(){
    char *original_file;
    long fsize;
    int quote_num = 0;
    int jcond_error = 0;
    FILE *file = fopen(JCOND_FILE_PATH, "r");
    if(file == NULL){
      jcond_stmt = malloc(30 * sizeof(char));
      if(jcond_stmt == NULL){
        printf("ERROR!! ...\n");
      }
      sprintf(jcond_stmt, "var jcondition_context = {};");
      return;
    }
    fseek(file, 0, SEEK_END);
    fsize = ftell(file);
    fseek(file, 0, SEEK_SET);
    original_file = calloc(fsize, sizeof(char));
    if(fread(original_file, sizeof(char), fsize, file) != fsize){
      printf("ERROR READING ...");
      jcond_stmt = malloc(30 * sizeof(char));
      sprintf(jcond_stmt, "var jcondition_context = {};");
      return;
    }
    fclose(file);
    for(int i = 0; i < fsize; i++){
      if(original_file[i] == '\"' || original_file[i] == '\'')
        quote_num++;
    }
    jcond_stmt = (char *)calloc(fsize + quote_num + 20, sizeof(char));
    sprintf(jcond_stmt, "var jcondition_context = %s", original_file);

    free(original_file);
    printf("Executed String .. %s\n", jcond_stmt);
    return;
}

void jcond_init_duktape(){
  if(jcond_stmt == NULL){
    jcond_read_context();
  }
  if(ctx != NULL){
    jcond_free_duktape(ctx);
  }
  //Now we are ready
  ctx = duk_create_heap_default();
  duk_eval_string(ctx, jcond_stmt);
}

int jcond_exec_stmt(char *stmt){
  jcond_init_duktape(); //Reinitialize the duktape system ...
  duk_eval_string(ctx, stmt);
  int ret = duk_get_boolean(ctx, -1);
  duk_pop(ctx);
  return ret;
}

void jcond_free_duktape(duk_context *ctx){
  duk_destroy_heap(ctx);
}

void jcond_set_error(char *err_msg){
  jcond_error = 1;
  sprintf(jcond_err_msg, "%s", err_msg);
}

char *jcond_get_error(){
  if(jcond_error){
    jcond_error = 0;
    return jcond_err_msg;
  }
  return NULL;
}
