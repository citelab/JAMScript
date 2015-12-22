#include <czmq.h>

#define MAX_RECVBUF_LEN                 256


//  Receive 0MQ string from socket and convert into C string
//  Caller must free returned string. Returns NULL if the context
//  is being terminated.
char * s_recv (void *socket) {
    char buffer [MAX_RECVBUF_LEN];
    int size = zmq_recv (socket, buffer, MAX_RECVBUF_LEN-1, 0);
    if (size == -1)
        return NULL;
    if (size > MAX_RECVBUF_LEN-1)
        size = MAX_RECVBUF_LEN-1;
    buffer [size] = 0;
    return strdup (buffer);
}

//  Convert C string to 0MQ string and send to socket
int s_send (void *socket, const char *string) {
    int size = zmq_send (socket, string, strlen (string), 0);
    return size;
}


int main(int argc, char *argv[])
{

    void *ctx = zmq_ctx_new();
    void *server = zmq_socket(ctx, ZMQ_REP);
    zmq_bind(server, "tcp://127.0.0.1:5555");

    while (1) {
        char *request = s_recv(server);

        printf("Request: %s\n", request);
        sleep(1);
        s_send(server, request);
        free(request);
    }

    zmq_close(server);
    zmq_ctx_destroy(ctx);
    return 0;
}
