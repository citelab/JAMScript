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

#include <nanomsg/nn.h>
#include <nanomsg/reqrep.h>

#include <assert.h>
#include <stdlib.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

#include "econtext.h"
#include "nano_utils.h"

/*
 * ping to j-core. it sends a ping request to given host at the REQUEST_PORT
 * which is the designated request-reply protocol (ping) port. The routine blocks
 * until a reply comes back. Because the ping processing at the remote side should
 * happen within an "expected" amount of time we can timeout properly on an
 * unresponsive node.
 */
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


/*
 * Register app with Fog. Sends a REGISTER APP appid request to the
 * REQUEST_PORT. We expect a reply from there within the timeout to
 * declare a winning fog..
 */
bool register_with_fog(char *hostname, char *appname, int timeout)
{
    struct nn_pollfd pfd[1];

    int sock = create_request_sock(hostname);
    send_request("REGISTER", "APP", appname);


    pfd[0].fd = sock;
    pfd[0].events = NN_POLLIN;
    int rc = nn_poll(pfd, 1, timeout);
    if (pfd[0].revents & NN_POLLIN) {
        char *msgbuf;
        bytes = nn_recv(sock, &msgbuf, NN_MSG, 0);
        assert(bytes >= 0);
        nn_freemsg(msgbuf);
        nn_shutdown(sock, 0);
        return true;
    }
    else
    {
        nn_shutdown(sock, 0);
        return false;
    }
}




/*
 * Try Fog servers in the order specified in the list..
 * Once a connection could be established with one of the Fog servers, note
 * down that number in "fog_state" variable.
 *
 * Return true if a fog server is responding for requests. Here we are establishing
 * a REQ and expecting a REPLY.
 * We could remember a socket for the connection.. however this socket could be state
 * an attempts to pull in packets through that interface could fail..
 */
bool try_fog_connection(e_context_t *ctx, int timeout)
{
    int i;

    for (i = 0; i < ctx->num_fog_servers; i++)  {
        int retries = ctx->retries;
        while (retries-- > 0) {
            if (ping_j_core(ctx->fog_servers[i], ctx->device_id, timeout)) {
                ctx->fog_state.server = ctx->fog_servers[i];
                ctx->fog_state.port = REQUEST_PORT;
                return true;
            }
        }
    }

    return false;
}


bool try_cloud_connection(e_context_t *ctx, int timeout)
{
    int i;

    for (i = 0; i < ctx->num_cloud_servers; i++)  {
        int retries = ctx->retries;
        while (retries-- > 0) {
            if (ping_j_core(ctx->cloud_servers[i], timeout)) {
                ctx->cloud_state.server = ctx->cloud_servers[i];
                ctx->cloud_state.port = REQUEST_PORT;
                return true;
            }
        }
    }

    return false;
}


/*
 *
 *
 *
 */
// this one just connects to the first fog server.. or tries to connect
// if a timeout is specified, it

bool connect_to_fog(e_context_t *ctx, int timeout)
{
    // We check
    // Hookup to survey
    // Hookup to publish..


    return true;
}

/*
 * initialize the c_core
 * get the context, try to connect the fog, if not to the cloud
 * if we are able to connect to the cloud, get the fog information and
 * try fog connection.
 * we can specify a timeout value in milliseconds to complete the initialization.
 * A timeout of -1 is indefinite wait.
 * Initialization completes only when we are able to connect to the Fog.
 * We could complete this by either directly connecting to the Fog server that
 * might have been specified or by indirect means through the cloud discovery
 * service.
 */

e_context_t *init_c_core(int timeout)
{
    // get execution context
    e_context_t *ctx = get_exec_context();
    assert(ctx != NULL);

    // Try connecting to Fog servers if they are available..
    if (!try_fog_connection(ctx, timeout)) {
        // if unable to connect to fog, now try the cloud..
        // we need at least the cloud to move forward..

        if (try_cloud_connection(ctx, timeout)) {
            // If the cloud connection is a success we should have new Fog
            // servers in the list.. lets connect to them..
            if (connect_to_fog(ctx, timeout))
                return ctx;
            else
                return NULL;
        }
        else
        {
            printf("ERROR!! Unable to connect to cloud.. \n");
            return NULL;
        }
    }
    else
        return ctx;             // we were able to connect to a specified Fog
}
