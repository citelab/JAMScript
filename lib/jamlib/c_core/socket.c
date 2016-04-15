/*

The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

#include <stdlib.h>
#include <stdio.h>
#include <string.h>

#include "socket.h"

#include <nanomsg/nn.h>
#include <nanomsg/reqrep.h>
#include <nanomsg/survey.h>
#include <nanomsg/pubsub.h>


socket_t *socket_new(enum socket_type type)
{
    socket_t *sock = (socket_t *)calloc(1, sizeof(socket_t));
    assert(sock != NULL);

    switch (type) {
        case SOCKET_REQU:
            sock->sock_fd = nn_socket(AF_SP, NN_REQ);
            break;

        case SOCKET_REPL:
            sock->sock_fd = nn_socket(AF_SP, NN_REP);
            break;

        case SOCKET_SURV:
            sock->sock_fd = nn_socket(AF_SP, NN_SURVEYOR);
            break;

        case SOCKET_RESP:
            sock->sock_fd = nn_socket(AF_SP, NN_RESPONDENT);
            break;

        case SOCKET_PUBL:
            sock->sock_fd = nn_socket(AF_SP, NN_PUB);
            break;

        case SOCKET_SUBS:
            sock->sock_fd = nn_socket(AF_SP, NN_SUB);
            break;

        case SOCKET_LOCL:
            // TODO: implement this.. open OS native sockets?
            break;

        case SOCKET_OTHE:
            // TODO: is this even needed?
            break;
    }
    assert(sock->sock_fd >= 0);

    return sock;
}


void socket_free(socket_t *socket)
{
    nn_shutdown(socket->sock_fd, 0);
    free(socket);
}


// This is binding the socket..
//
bool socket_create(socket_t *socket, char *host, int port)
{
    if (socket->type == SOCKET_REPL ||
        socket->type == SOCKET_RESP ||
        socket->type == SOCKET_SUBS) {

        printf("Socket create called on wrong type (%d) of socket\n", socket->type);
        exit(1);
    }

    char *url = socket_new_url(host, port);
    assert(nn_bind(socket->sock_fd, url) >= 0);
    free(url);

    return true;
}


bool socket_connect(socket_t *socket, char *addr, int port)
{
    char *url = socket_new_url(addr, port);
    printf("Connecting to %s\n", url);
    assert(nn_connect(socket->sock_fd, url) >= 0);
    free(url);

    return true;
}


int socket_send(socket_t *sock, command_t *cmd)
{
    int bytes = nn_send(sock->sock_fd, cmd->buffer, cmd->length, 0);
    assert(bytes == cmd->length);
    printf("Sent %d bytes..\n", bytes);
    // return the number of bytes sent out..
    return bytes;
}


command_t *socket_recv_command(socket_t *sock, int timeout)
{
    struct nn_pollfd pfd [1];
    pfd[0].fd = sock->sock_fd;
    pfd[0].events = NN_POLLIN;

    int rc = nn_poll(pfd, 1, timeout);
    if (rc == 0) {
        return NULL;
    }

    printf("Over here.. \n");
    unsigned char *buffer = NULL;

    int bytes = nn_recv(sock->sock_fd, &buffer, NN_MSG, 0);
    nvoid_t *nv = nvoid_new(buffer, bytes);
    printf("Over here.. 2 \n");
    command_t *cmd = command_from_data(NULL, nv);
    printf("Over here.. 3 \n");
    nn_freemsg(buffer);
    nvoid_free(nv);
    printf("Hello 2 \n");
    return cmd;
}


char *socket_new_url(char *host, int port)
{
    char buffer[256];               // We assume that max URL size is less than 256!
    sprintf(buffer, "tcp://%s:%d", host, port);

    return strdup(buffer);
}
