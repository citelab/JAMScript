#include <stdio.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>


#include "socket.h"
#include "command.h"

int main(void)
{
    socket_t *sock = socket_new(SOCKET_REQU);
    socket_connect(sock, "127.0.0.1", 5000);

    printf("Connecting.. or packets..\n");

    while (1)
    {
        command_t *scmd = command_new("PING", "TEST", "HELLO", "s", "hello");
        socket_send(sock, scmd);
        command_free(scmd);
        printf("Blah \n");
        command_t *rcmd = socket_recv_command(sock, 5000);
        printf("Blah 2 \n");
        if (rcmd == NULL)
            printf("No command received \n");
        else
            command_print(rcmd);
    }

}
