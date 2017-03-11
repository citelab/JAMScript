#include <unistd.h>
#include "jdata.h"
#include "command.h"
#include "jam.h"

typedef char* jcallback;
jamstate_t *js;
void isPalindromeC(char* text){
size_t length = strlen(text);
size_t half = length / 2;
size_t start = 0;
size_t end = length - 1;
char space = 32;
char comma = 44;
char startSpace, endSpace;
while(half > 0) {
startSpace = (text[start] == space || text[start] == comma);
endSpace = (text[end] == space || text[end] == comma);
if(text[start] == text[end]) {
start++;
end--;
} else if(startSpace || endSpace) {
start++;
end--;
} else {
return;
}
half--;
}
return;
}
void callisPalindromeC(void *act, void *arg) {
command_t *cmd = (command_t *)arg;
isPalindromeC(cmd->args[0].val.sval);
}

int user_main() {
return 0;
}

void user_setup() {
activity_regcallback(js->atable, "isPalindromeC", ASYNC, "s", callisPalindromeC);
}

void jam_run_app(void *arg) {
user_main();
}

void taskmain(int argc, char **argv) {

    js = jam_init(1883);
    user_setup();
     
    taskcreate(jam_event_loop, js, 50000);
    taskcreate(jam_run_app, js, 50000);
  }
