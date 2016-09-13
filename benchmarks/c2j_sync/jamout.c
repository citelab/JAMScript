typedef char* jcallback;
jamstate_t *js;
int   main();
char *  ping_sync(char*);
int user_main() {
int errors = 0;
for (int i = 0; i < 100; i++) {
char *rcv = ping_sync("PING");
if(strcmp(rcv, "PONG") != 0) {
printf("DAMMIT ROBERT ON C SIDE\n");
errors++;
}
sleep(1);
}
for (int i = 0; i < 100; i++) {
char *rcv = ping_sync("PING");
if(strcmp(rcv, "PONG") != 0) {
printf("DAMMIT ROBERT ON C SIDE\n");
errors++;
}
}
printf("Errors: %d\n", errors);
return 0;
}

void user_setup() {
}

void jam_run_app(void *arg) {
user_main();
}

void taskmain(int argc, char **argv) {

    js = jam_init();
    user_setup();
     
    taskcreate(jam_event_loop, js, 50000);
    taskcreate(jam_run_app, js, 50000);
  }char* ping_sync(char* msg) {
arg_t *res = jam_rexec_sync(js, "ping_sync", "s",msg);
char* ret = res->val.sval;
command_arg_free(res);
return ret;
}

