#include <stdio.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>


#include "socket.h"
#include "command.h"

int main(void)
{
    socket_t *sock = socket_new(SOCKET_REPL);
    socket_create(sock, "127.0.0.1", 5000);

    printf("fffff Listening for packets..\n");
    while (1)
    {
        command_t *rcmd = socket_recv_command(sock, 500);
        if (rcmd == NULL) {
            printf("Timeout...\n");
            continue;
        }
        if (strcmp(rcmd->cmd, "PING") == 0)
            command_print(rcmd);
        printf("Found a packet..\n");
    //    command_t *scmd = command_new("PONG", "TEST", "HELLO", "s", "hello");
//        command_free(rcmd);
        socket_send(sock, rcmd);
        command_free(rcmd);
    }
}
