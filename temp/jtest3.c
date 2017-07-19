#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>

#include <cbor.h>

#include <hiredis.h>
#include <async.h>
#include <adapters/libev.h>
#include <ev.h>

char *dev_id = "e2952f95-8373-4948-b539-3ebad3619940";
char *app_id = "re";

char *DELIM = "$$$";

int i = 10;

struct ev_Loop *loop;

typedef void (*msg_rcv_callback)(redisAsyncContext *c, void *reply, void *privdata);

void jamdata_log_to_server(redisAsyncContext *c, char *namespace, char *logger_name, char *value, msg_rcv_callback callback);

void getCallback(redisAsyncContext *c, void *r, void *privdata) {
    redisReply *reply = r;
    if (reply == NULL) return;
    printf("-----------------argv[%s]: %s\n", (char*)privdata, reply->str);

    /* Disconnect after receiving the reply to GET */
    redisAsyncDisconnect(c);
}

void connectCallback(const redisAsyncContext *c, int status) {
    if (status != REDIS_OK) {
        printf("Error: %s\n", c->errstr);
        return;
    }
    printf("Connected...\n");
}


void disconnectCallback(const redisAsyncContext *c, int status) {
    if (status != REDIS_OK) {
        printf("Error: %s\n", c->errstr);
        return;
    }
    printf("Disconnected...\n");
}


//fmt - string: format string such as "%s%d%f"
//args followed fmt will be paired up. For example,
//parseCmd("%s%d", "person", "Lilly", "age", 19) indicates the variable named "person"
//is expected to have a string type value followed, which is "Lilly" in this case
char* jamdata_encode(char *fmt, ...){
  int i, num = strlen(fmt);
  if(num==0) return NULL;

  //root   - cbor map: object contains encoded info about input args
  //content- encoded primitive type: argument's content
  //key    - encoded string: argument's name
  cbor_item_t *root = cbor_new_indefinite_map();
  //initialize args to be used by va_end and va_arg
  va_list args;
  va_start(args, fmt);

  char *name, *s;
  int t;
  double f;

  //fmt_str is in the format such as sdf
  for(i=0;i<num;i++){
    //name of the value
    name = va_arg(args, char *);

    if(fmt[i]=='s'){
      s = va_arg(args, char *);
      cbor_map_add(root, (struct cbor_pair){
        .key = cbor_move(cbor_build_string(name)),
        .value = cbor_move(cbor_build_string(s))
      });
    }
    else if(fmt[i]=='i' || fmt[i]=='d'){
      t = abs(va_arg(args, int));
      cbor_map_add(root, (struct cbor_pair){
        .key = cbor_move(cbor_build_string(name)),
        .value = cbor_move(cbor_build_uint32(t))
      });
    }
    else if(fmt[i]=='f'){
      f = va_arg(args, double);
      cbor_map_add(root, (struct cbor_pair){
        .key = cbor_move(cbor_build_string(name)),
        .value = cbor_move(cbor_build_float8(f))
      });
    }
    else{
      printf("Invalid format string\n");
      return NULL;
    }
  }
  va_end(args);

  unsigned char *buffer;
  size_t buffer_size, len = cbor_serialize_alloc(root, &buffer, &buffer_size);

  char *dump = (char *)malloc(len*2+2);
  for(i=0;i<len;i++){
    sprintf(dump+2*i, "%02X", buffer[i]);
  }
  sprintf(dump+2*i, "%02X", '\0');

  cbor_decref(&root);
  free(buffer);
  return dump;
}

/*
 * This is the default jdata received callback.
 * This is utilized when a jdata is called but no callback was assigned. It will simply print the value.
 * You do not need to use this anywhere, this is only utilized in the library as a default callback.
 */
void jdata_default_msg_received(redisAsyncContext *c, void *reply, void *privdata) {
  redisReply *r = reply;


  if (r == NULL)
    printf("Reply is NULL\n");
  else
    printf("Reply is NOT NULL -- %d\n", r->type);

  printf("Default message from REDIS...\n");

  //ev_unref(loop);
  //ev_break (EV_A_ EVBREAK_ONE);
  printf("After loop\n");

  i--;
  if (i > 0)
  {
      char *data = jamdata_encode("if", "apple", i, "pear", i+0.1);
      jamdata_log_to_server(c, "global", "s", data, ((void*)0));
  }
  else
    ev_unref(loop);

}


/*
 * jdata function to log to server.
 * requires jdata to have been initialized first. Otherwise will segfault.
 *
 * Inputs
 *  key -> The jdata variable name
 *  value -> the value to be logged
 *  callback -> the callback function if you want a custom callback to signal when a log succeeds.
                        Can be null
 * jdata grade = 'A'
 * -> jdata_log_to_server("grade", 'A', null);
 */
void jdata_log_to_server(redisAsyncContext *c, char *key, char *value, msg_rcv_callback callback){

  if(callback == NULL) callback = jdata_default_msg_received;

  int length = strlen(value) + strlen(DELIM) + strlen(app_id) + strlen(DELIM) + 10;
  char newValue[length];
  sprintf(newValue , "%s%s%s", value, DELIM, app_id);
  perror("Before");
  int rack = redisAsyncCommand(c, callback, NULL, "EVAL %s 1 %s %s", "redis.replicate_commands(); \
                                                          local t = (redis.call('TIME'))[1]; \
                                                          local insert_order =  redis.call('ZCARD', KEYS[1]) + 1; \
                                                          redis.call('ZADD', KEYS[1], t, ARGV[1] .. \"$$$\" .. insert_order .. \"$$$\" .. t); \
                                                          return {t}", key, newValue);
  #ifdef DEBUG_LVL1
  //  printf("Logging executed... %d\n", rack);
    perror("Logger...");
  #endif
}


void jdata_send_to_server(redisContext *c, char *key, char *value){


  int length = strlen(value) + strlen(DELIM) + strlen(app_id) + strlen(DELIM) + 10;
  char newValue[length];
  sprintf(newValue , "%s%s%s", value, DELIM, app_id);
  int rack = redisCommand(c, "EVAL %s 1 %s %s", "redis.replicate_commands(); \
                                                          local t = (redis.call('TIME'))[1]; \
                                                          local insert_order =  redis.call('ZCARD', KEYS[1]) + 1; \
                                                          redis.call('ZADD', KEYS[1], t, ARGV[1] .. \"$$$\" .. insert_order .. \"$$$\" .. t); \
                                                          return {t}", key, newValue);
}


void jamdata_log_to_server(redisAsyncContext *c, char *namespace, char *logger_name, char *value, msg_rcv_callback callback)
{
  printf("Calling... jamdata_log\n");
  if(value != NULL){
    char format[] = "apps[%s].namespaces[%s].datasources[%s].datastreams[%s]";
    char key[strlen(app_id) + strlen(namespace) + strlen(logger_name) + strlen(dev_id) + sizeof format - 8];
    sprintf(key, format, app_id, namespace, logger_name, dev_id);
    jdata_log_to_server(c, key, value, callback);
    perror("After jdata");
  }
  else printf("Empty data\n");
}


void jamdata_send_to_server(redisContext *c, char *namespace, char *logger_name, char *value)
{

  if(value != NULL){
    char format[] = "apps[%s].namespaces[%s].datasources[%s].datastreams[%s]";
    char key[strlen(app_id) + strlen(namespace) + strlen(logger_name) + strlen(dev_id) + sizeof format - 8];
    sprintf(key, format, app_id, namespace, logger_name, dev_id);
    jdata_send_to_server(c, key, value);
  }
}



int jamsend_data(char *data)
{
    signal(SIGPIPE, SIG_IGN);

    redisAsyncContext *c = redisAsyncConnect("127.0.0.1", 6379);
    if (c->err) {
        /* Let *c leak for now... */
        printf("Error: %s\n", c->errstr);
        return 1;
    }

    redisLibevAttach(loop, c);
    redisAsyncSetConnectCallback(c,connectCallback);
    redisAsyncSetDisconnectCallback(c,disconnectCallback);

    jamdata_log_to_server(c, "global", "s", data, ((void*)0));
    ev_loop(loop, 0);

    return 0;
}

void starteventloop()
{
    ev_loop(EV_DEFAULT_ 0);
}

int main (int argc, char **argv) {

    loop = ev_default_loop(0);

    redisAsyncContext *c = redisAsyncConnect("127.0.0.1", 6379);
    if (c->err) {
        /* Let *c leak for now... */
        printf("Error: %s\n", c->errstr);
        return 1;
    }

    redisLibevAttach(loop, c);
    redisAsyncSetConnectCallback(c,connectCallback);
    redisAsyncSetDisconnectCallback(c,disconnectCallback);

    char *data = jamdata_encode("if", "apple", i, "pear", i+0.1);
    jamdata_log_to_server(c, "global", "s", data, ((void*)0));
    ev_loop(loop, 0);

}
