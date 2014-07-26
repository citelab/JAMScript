/*

The MIT License (MIT)
Copyright (c) 2011 Derek Ingrouville, Julien Lord, Muthucumaru Maheswaran

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

#ifndef _SOCKET_H
#define _SOCKET_H

typedef enum
{
    TCPClient,
    TCPServer,
    InvalidSocket
} SocketType;

typedef enum
{
    Socket_Blocking,
    Socket_NonBlocking
} SocketBlocking;

typedef struct _Socket
{
    unsigned int   sock_fd;
    SocketType     type;
    SocketBlocking blocktype;
} Socket;

Socket *socket_new(SocketBlocking blocktype);
void socket_free(Socket *socket);

int socket_connect(Socket *socket, char *addr, char *port);
int socket_listen(Socket *socket, char *port, int backlog);
Socket *socket_accept(Socket *socket, SocketBlocking blocktype);

int socket_read(Socket *socket, char *dest_buf, int len);
char *socket_readline(Socket *osocket, char *lineterm);
int socket_write(Socket *socket, char *data, int len);

int socket_enable_blocktype(int sock_fd, SocketBlocking blocktype);

unsigned int socket_select(Socket *socket, long seconds, long usec);
void wait_until_data_available (Socket *socket);

#endif /* _SOCKET_H_ */

#ifdef __cplusplus
}
#endif