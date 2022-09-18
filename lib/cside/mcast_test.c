#include "./src/multicast.h"
#include <stdio.h>
#include <string.h>

char buffer[100];

int main(int argc) {
    mcast_t *m = multicast_init("224.1.1.1", 17500, 16500);

    char *msg = "hello, world.... this is mahesh..! ";
    // bzero(buffer, 100);

  //  if (argc > 1) {
    //    multicast_setup_recv(m);
        //multicast_send(m, msg, strlen(msg));
    //} else {

        multicast_setup_recv(m);
        printf("==============\n");
        multicast_send(m, msg, strlen(msg));
        printf("==============\n");
        while (1) {
            while (multicast_check_receive(m) == 0) {
                multicast_send(m, msg, strlen(msg));
                printf("repeat.. \n");
            }
            multicast_receive(m, buffer, 100);
            printf("Received... %s\n", buffer);
        }
    //}
}