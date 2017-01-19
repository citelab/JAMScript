#include <stdio.h>
#include <string.h>
#include <poll.h>

#define NUM_MSG 20

int setup();
char* get_past_msg(int);
int get_new_id(char*);
jactivity_t* j_node_get_msg(char*, char*, int);

struct pollfd qpollfds[2];
int ID = 0;
int current_msg_id = -1;


jasync c_node_get_msg(char * usr_name, char * msg, int usr_id, int msg_id){
    if(usr_id != ID){
      if(current_msg_id != msg_id){
        printf("%s:%s", usr_name, msg);
        current_msg_id = msg_id;
      }
    }
}


int main() {
    char * buf = NULL;
    size_t len = 0;
    char * res;
    char * usr_name;
    int numfds;

    setup();
    printf("Enter your desired username: ");
    getline(&buf, &len, stdin);
    ID = get_new_id("GET_ID");
    printf("Currently ID :%d\n", ID);
    res = get_past_msg(NUM_MSG);
    printf("\n\n-----------------BEGIN--------------------\n\n");
    printf("Client Service Initiated ...  \n%s\n", res);
    usr_name = strdup(buf);
    usr_name[strlen(usr_name) - 1] = ' ';
    free(buf);
    len = 0;

    qpollfds[0].fd = 0;
    qpollfds[0].events = POLLIN;

    while(1){
        buf = NULL;
        numfds = poll(qpollfds, 1, 500);

      if (qpollfds[0].revents & POLLIN) {
          printf("\n\n\n%s: ", usr_name);            
          getline(&buf, &len, stdin);
          printf("Your input: %s\n", buf);
          j_node_get_msg(usr_name, buf, ID);
      }
      taskyield();
      len = 0;
      free(buf);
    }
}