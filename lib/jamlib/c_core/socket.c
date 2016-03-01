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

#include <stdlib.h>
#include <stdio.h>
#include <string.h>

#include <unistd.h>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netdb.h>
#include <errno.h>

#include <sys/timeb.h>

#include "socket.h"


bool ping_j_core(char *hostname, char *devid, int timeout)
{
    struct nn_pollfd pfd[1];

    int sock = create_request_sock(hostname);
    send_request("PING", "JCORE", devid);

    pfd[0].fd = sock;
    pfd[0].events = NN_POLLIN;
    int rc = nn_poll(pfd, 1, timeout);
    if (pfd[0].revents & NN_POLLIN) {
        char *msgbuf;
        bytes = nn_recv(sock, &msgbuf, NN_MSG, 0);
        assert(bytes >= 0);
        nn_freemsg(msgbuf);
        // should we check the message for any particular pattern?

        nn_shutdown(sock, 0);
        return true;
    }
    else
    {
        nn_shutdown(sock, 0);
        return false;
    }
}



Socket *socket_new(SocketBlocking blocktype)
{
    Socket *socket = NULL;

    socket = (Socket *) malloc(sizeof(Socket));
    if (socket == NULL) {
        fprintf(stderr, "socket_new: Memory allocation error\n");
        return NULL;
    }

    socket->sock_fd = 0;
    socket->type = InvalidSocket;
    socket->blocktype = blocktype;

    return socket;
}

static void socket_close(Socket *socket)
{
    if (socket == NULL)
        return;

    if (socket->sock_fd > 0) {
        close(socket->sock_fd);
        socket->sock_fd = 0;
    }
}

void socket_free(Socket *socket)
{
    if (socket != NULL) {
        socket_close(socket);
        free(socket);
    }
}

struct addrinfo *socket_get_addrinfo(Socket *sock, const char *addr, const char *port)
{
    struct addrinfo hints;
    struct addrinfo *ai_head = NULL;
    int ret = 0;

    /* Note it is valid to pass a NULL addr to this function */
    /* This occurs when sock->type = TCPServer */
    if (&socket == NULL || port == NULL)
        return NULL;

    memset(&hints, 0, sizeof(hints));
    hints.ai_family   = AF_UNSPEC;     /* Don't restrict to IPV4 */
    hints.ai_socktype = SOCK_STREAM;   /* We'll use TCP */
    if (sock->type == TCPServer)
        hints.ai_flags = AI_PASSIVE;   /* Use local IP */

    if ((ret = getaddrinfo(addr, port, &hints, &ai_head)) != 0) {
        fprintf(stderr, "socket: getaddrinfo error - %s\n", gai_strerror(ret));
        return NULL;
    }

    return ai_head;
}

int socket_enable_blocktype(int sock_fd, SocketBlocking blocktype)
{
    if (blocktype == Socket_NonBlocking) {
        if (fcntl(sock_fd, F_SETFL, O_NONBLOCK) == -1) {
            return -1;
        }
    }

    return 0;
}

int socket_connect(Socket *sock, char *addr, char *port)
{
    struct addrinfo *ai_node, *ai_head;
    int fd = 0;

    if (sock == NULL || addr == NULL || port == NULL)
        return -1;

    sock->type = TCPClient;
    ai_head = socket_get_addrinfo(sock, addr, port);

    /* Iterate over the linked list returned
     * Connect to the first one that works
     * Using this method allows us to support IPV6 also */
    ai_node = ai_head;
    while (ai_node != NULL) {
        fd = socket(ai_node->ai_family, ai_node->ai_socktype, ai_node->ai_protocol);
        if (fd == -1) {
            ai_node = ai_node->ai_next;
            if (ai_node == NULL)
                perror("socket_connect: socket");
            continue;
        }

        if(connect(fd, ai_node->ai_addr, ai_node->ai_addrlen) == -1) {
            close(fd);
            ai_node = ai_node->ai_next;
            if (ai_node == NULL)
                perror("socket_connect: connect");
            continue;
        }

        if (socket_enable_blocktype(fd, sock->blocktype) != 0) {
            close(fd);
            return -1;
        }
        break;
    }

    freeaddrinfo(ai_head);

    if (ai_node == NULL) {
        /* We looped through all nodes without connecting */
        return -1;
    }

    sock->sock_fd = fd;

    return 0;
}

int socket_listen(Socket *sock, char *port, int backlog)
{
    struct addrinfo *ai_node, *ai_head;
    int fd = 0;
    int reuse = 1;

    if (sock == NULL || port == NULL || backlog < 0)
        return -1;

    sock->type = TCPServer;
    ai_head = socket_get_addrinfo(sock, NULL, port);

    /* Iterate over the linked list returned
     * Bind to the first one that works
     * Using this method allows us to support IPV6 also */
    ai_node = ai_head;
    while (ai_node != NULL) {
        fd = socket(ai_node->ai_family, ai_node->ai_socktype, ai_node->ai_protocol);
        if (fd == -1) {
            ai_node = ai_node->ai_next;
            if (ai_node == NULL)
                perror("socket_listen: socket");
            continue;
        }

        if (socket_enable_blocktype(fd, sock->blocktype) != 0) {
            close(fd);
            return -1;
        }

        /* Reuse a port if possible */
        if(setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(int)) == -1) {
            perror("socket_listen: setsockopt()");
            close(fd);
            freeaddrinfo(ai_head);
            return -1;
        }

        if(bind(fd, ai_node->ai_addr, ai_node->ai_addrlen) == -1) {
            close(fd);
            ai_node = ai_node->ai_next;
            if (ai_node == NULL)
                perror("socket_listen: bind");
            continue;
        }
        break;
    }
    freeaddrinfo(ai_head);

    if(ai_node == NULL) {
        /* We looped through all nodes without binding */
        return -1;
    }

    /* Now listen */
    if (listen(fd, backlog) == -1) {
        perror("socket_listen: listen()");
        close(fd);
        return -1;
    }

    sock->sock_fd = fd;

    return 0;
}

Socket *socket_accept(Socket *sock, SocketBlocking blocktype)
{
    Socket *newsock = NULL;
    struct sockaddr_storage remote_addr;
    socklen_t size = sizeof remote_addr;
    int newfd = 0;

    if (sock == NULL)
        return NULL;

    if (sock->type != TCPServer || sock->sock_fd <= 0)
        return NULL;

    newfd = accept(sock->sock_fd, (struct sockaddr *) &remote_addr, &size);
    if(newfd == -1) {
        perror("socket_accept: accept()");
        return NULL;
    }

    if (blocktype == Socket_NonBlocking) {
        if (fcntl(newfd, F_SETFL, O_NONBLOCK) == -1) {
            close(newfd);
            return NULL;
        }
    }

    newsock = socket_new(blocktype);
    if(newsock == NULL) {
        close(newfd);
        return NULL;
    }

    newsock->sock_fd = newfd;

    return newsock;
}

int socket_read(Socket *socket, char *dest_buf, int len)
{
    int ret = 0;
    int recv_len = 0;

    if (socket == NULL || dest_buf == NULL || len < 0)
        return -1;

    if (socket->sock_fd <= 0)
        return -1;

    while (recv_len < len) {
        ret = recv (socket->sock_fd, dest_buf + recv_len, len - recv_len, 0);

        if (ret <= 0) {
            break;
        }

        recv_len += ret;
    }

    if (recv_len > 0)
        return recv_len;
    else
        return -1;

    return recv_len;
}

int socket_write(Socket *socket, char *data, int len)
{
    int ret = 0;
    int sent = 0;
    struct timeval tv;
    fd_set fds;

    if (socket == NULL || data == NULL || len < 0)
        return -1;

    if (socket->sock_fd <= 0)
        return -1;

    tv.tv_sec = 0;
    tv.tv_usec = 3000; /* Microseconds */

    FD_ZERO (&fds);
    FD_SET (socket->sock_fd, &fds);


    while (sent < len) {
        ret = send (socket->sock_fd, data + sent, len - sent, 0);

        if (ret < 0) {
            /* Check if the send failed because it would block */
            if (errno == EAGAIN || errno == EWOULDBLOCK) {
                /* Select until we can write */
                select (socket->sock_fd + 1, NULL, &fds, NULL, &tv);
            }
            else
                return ret;
        }
        else
            sent += ret;
    }

    return sent;
}

/* Return the position of line term in the recv buffer */
/* This assumes that lineterm either doesn't appear, or shows up in the first
 * 1024 bytes of the recv buffer. This doesn't handle the case where lineterm
 * crosses a 1024 byte boundary.
 */
static int socket_lineterm_position (Socket *socket, char *lineterm)
{
    char buf[1024];
    int bufsize = 1024;
    char *substr = NULL;
    int recv_ret = 0;
    int delim_size = 0;
    int pos = 0;

    if (socket == NULL || lineterm == NULL)
        return -1;

    delim_size = strlen (lineterm);
    if (delim_size > bufsize)
        return -1;

    recv_ret = recv (socket->sock_fd, buf, bufsize, MSG_PEEK);

    if (recv_ret == 0) {
        /* Remote closed socket */
        return -1;
    }
    else if (recv_ret == -1) {
        return -1;
    }

    buf[recv_ret] = '\0';

    if ((substr = strstr (buf, lineterm)) != NULL) {

        pos = (substr - buf);
        pos += delim_size;
        return pos;
    }

    return 0;
}

/* Lineterm must be within the first 1024 bytes of the recv() buffer
 * it must not cross a 1024 byte boundary
 */
char *socket_readline (Socket *socket, char *lineterm)
{
    char *tmp_buffer    = NULL; /* Holds the full line, including linetime */
    char *return_buffer = NULL; /* Line without line term delimiter */
    int lineterm_len = 0; /* Length of lineterm delimiter */
    int recv_len = 0;     /* Bytes read */
    int term_pos = 0;     /* length of the line (including lineterm delimiter)*/
    int tmp_size = 0;     /* Size of tmp buffer */
    int return_size = 0;  /* Size of return buffer */

    if (socket == NULL || lineterm == NULL)
        return NULL;

    lineterm_len = strlen(lineterm);

    term_pos = socket_lineterm_position (socket, lineterm);

    if (term_pos <= 0)
        return NULL;

    if (term_pos < lineterm_len)
        return NULL;

    /* Read the full line, including the delimiter */
    tmp_size = term_pos;
    tmp_buffer = (char *) malloc (tmp_size + 1);
    recv_len = recv (socket->sock_fd, tmp_buffer, tmp_size, 0);
    if (recv_len != tmp_size) {
        free (tmp_buffer);
        return NULL;
    }
    tmp_buffer[tmp_size] = '\0';

    /* Remove lineterm from the string */
    return_size = tmp_size - lineterm_len;

    if (return_size <= 0) {
        free(tmp_buffer);
        return NULL;
    }

    /*Allocate an extra byte for the '\0' */
    return_buffer = malloc(return_size + 1);
    strncpy(return_buffer, tmp_buffer, return_size);
    return_buffer[return_size] = '\0'; /* Should not be necessary */

    free(tmp_buffer);



    return return_buffer;
}


unsigned int socket_select (Socket *socket, long seconds, long usec)
{
    struct timeval tv;
    fd_set fds;

    if (socket == NULL) {
        fprintf(stderr, "socket_select: null socket\n");
        return 0;
    }
    if (socket->sock_fd <= 0) {
        fprintf(stderr, "socket_select: invalid fd. fd = %d\n", socket->sock_fd);
        return 0;
    }

    tv.tv_sec = seconds;
    tv.tv_usec = usec; /* Microseconds */

    FD_ZERO (&fds);
    FD_SET (socket->sock_fd, &fds);

    if (select (socket->sock_fd + 1, &fds, NULL, NULL, NULL) == -1) {
        perror("socket_select: select()");
        return socket_select(socket, seconds, usec);
    }

    if (FD_ISSET (socket->sock_fd, &fds))
        return 1;
    else
        return 0;
}

/* Return value is 0 if everything is ok.
 * Otherwise, return value is -1.
 */
int wait_until_data_available(Socket *socket)
{
    fd_set fds;

    FD_ZERO (&fds);
    FD_SET (socket->sock_fd, &fds);

    int x = select (socket->sock_fd + 1, &fds, NULL, NULL, NULL);
    return x < 0 ? -1 : 0;
}
