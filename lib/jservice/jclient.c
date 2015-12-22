#include <czmq.h>

#define REQUEST_TIMEOUT                 2500
#define REQUEST_RETRIES                 3
#define JSERVICE_ENDPT                  "tcp://127.0.0.1:5555"
#define MAX_CMDLINE_LEN                 128


int main(int argc, char *argv[])
{
    char cmd[MAX_CMDLINE_LEN];
    // Setup the socket..
    zctx_t *ctx = zctx_new();
    void *client = zsocket_new(ctx, ZMQ_REQ);
    assert(client);
    zsocket_connect(client, JSERVICE_ENDPT);

    int retries_left = REQUEST_RETRIES;

    while (retries_left && !zctx_interrupted) {

        // show the shell prompt and get input
        printf("\nCmd > ");
        scanf("%s", cmd);

        zstr_send(client, cmd);
        int expect_reply = 1;

        while (expect_reply) {
            zmq_pollitem_t items[] = { {client, 0, ZMQ_POLLIN, 0}};

            int rc = zmq_poll (items, 1, REQUEST_TIMEOUT * ZMQ_POLL_MSEC);
            if (rc == -1)
                break;          // interrupted

            if (items[0].revents && ZMQ_POLLIN) {
                char *reply = zstr_recv(client);
                if (!reply)
                    break;          // interrupted
                printf("Reply: %s\n", reply);
                free(reply);
                expect_reply = 0;
            }
            else
            if (--retries_left == 0) {
                printf("Server is offline... \n");
                break;
            }
            else {
                // Old socket is not responding...
                zsocket_destroy(ctx, client);
                client = zsocket_new(ctx, ZMQ_REQ);
                zsocket_connect(client, JSERVICE_ENDPT);
                zstr_send(client, cmd);
            }
        }
    }
    zctx_destroy(&ctx);
    return 0;
}
