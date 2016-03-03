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

#ifdef __cplusplus
extern "C" {
#endif

#ifndef __SOCKET_H__
#define __SOCKET_H__

#include "command.h"


enum socket_type
{
    SOCKET_REQU,
    SOCKET_REPL,
    SOCKET_SURV,
    SOCKET_RESP,
    SOCKET_PUBL,
    SOCKET_SUBS,
    SOCKET_LOCL,
    SOCKET_OTHE
};

typedef struct _socket_t
{
    unsigned int   sock_fd;
    enum socket_type type;
} socket_t;


socket_t *socket_new(enum socket_type type);
void socket_free(socket_t *socket);

bool socket_create(socket_t *socket, char *host, int port);

bool socket_connect(socket_t *socket, char *addr, int port);

int socket_send(socket_t *sock, command_t *cmd);
command_t *socket_recv_command(socket_t *sock, int timeout);
char *socket_new_url(char *host, int port);

#endif /* __SOCKET_H__ */

#ifdef __cplusplus
}
#endif
