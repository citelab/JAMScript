#include <stdio.h>
#include <string.h>
#include <poll.h>

#define NUM_MSG 20

jsync int setup() {
  var a;
  ID = 1;
  msg_list = ["Chat Service Initiated... ", "Hope this works ... "];
  return 1;
}

jsync char * get_past_msg(int num_msg){
  var begin = 0;
  var end = num_msg;
  var ret = "";
  if(num_msg > msg_list.length){
    begin = msg_list.length - num_msg;
  }else{
    end = 0;
  }
  ret += msg_list.slice(begin, end).join("\n");
  console.log("We are sending.... \n-------------------------------------------------\n" + ret)
  return ret;
}

jsync int get_new_id(char * status_msg) {
  var a;
  console.log(status_msg + " and " + ID);
  ID += 1;
  return ID;
}

jasync j_node_get_msg(char * usr_name, char * msg, int user_id) {
  var a;
  console.log("\n----------------Server Message Received-------------\n" + usr_name + ": " + msg);
  c_node_get_msg(usr_name, msg, user_id);
}

jasync c_node_get_msg(char * usr_name, char * msg, int msg_id) {
    printf("\n----------------You have received a Message-------------------\n");
    printf("%s:%s", usr_name, msg);
}

struct pollfd qpollfds[2];

int main() {
    char * buf = NULL;
    size_t len = 0;
    int id;
    char * res;
    char * usr_name;
    int numfds;
    
    setup();
    printf("Enter your desired username: ");
    getline(&buf, &len, stdin);
    id = get_new_id("GET_ID");
    printf("Currently ID :%d\n", id);
    res = get_past_msg(20);
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

      if (qpollfds[0].revents & POLLIN)
        {
          printf("\n\n\n%s: ", usr_name);            
          getline(&buf, &len, stdin);
          printf("Your input: %s\n", buf);
          j_node_get_msg(usr_name, buf, id);
        }
      taskyield();
      len = 0;
      free(buf);
    }
}