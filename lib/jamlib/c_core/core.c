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

#include <assert.h>
#include <stdlib.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

#include "core.h"
#include "socket.h"
#include "command.h"



/*
 * ping to j-core. it sends a ping request to given host at the REQUEST_PORT
 * which is the designated request-reply protocol (ping) port. The routine blocks
 * until a reply comes back. Because the ping processing at the remote side should
 * happen within an "expected" amount of time we can timeout properly on an
 * unresponsive node.
 */

bool core_ping_jcore(char *hostname, int port, char *devid, int timeout)
{
    command_t *scmd;

    // create a request-reply socket
    socket_t *sock = socket_new(SOCKET_REQU);
    socket_connect(sock, hostname, port);
    if (devid != NULL)
        scmd = command_new("PING", "JCORE", "", 0, "s", devid);
    else
        scmd = command_new("PING", "JCORE", "", 0, "");

    socket_send(sock, scmd);
    command_free(scmd);

    command_t *rcmd = socket_recv_command(sock, timeout);
    if (rcmd == NULL)
        return false;
    else
    {
        if (strcmp(rcmd->cmd, "PONG") == 0)
        {
            command_free(rcmd);
            return true;
        }
        else
        {
            command_free(rcmd);
            return false;
        }
    }
}

/*
 * Connect to Fog. Try the connection using the different options we have for Fog
 * endpoints. If we are able to succeed, then initiate a register protocol with the Fog.
 * The registration takes care of the RESPONDANT and SUBSCRIBE sockets that a device
 * needs to open in the Fog.
 */
bool core_connect_to_fog(corestate_t *cstate, int timeout)
{
    int i;
    command_t *scmd;

    if (cstate->device_id)
        scmd = command_new("REGISTER", "JCORE", "", 0, "s", cstate->device_id);
    else
        scmd = command_new("REGISTER", "JCORE", "", 0, "s", "--NEW-NODE--");

    for (i = 0; i < cstate->env->num_fog_servers; i++) {

        // create a request-reply socket
        socket_t *sock = socket_new(SOCKET_REQU);
        socket_connect(sock, cstate->env->fog_servers[i], REQUEST_PORT);
        socket_send(sock, scmd);

        command_t *rcmd = socket_recv_command(sock, timeout);
        if (rcmd == NULL)
        {
            command_free(rcmd);
            continue;
        }
        else
        {
            if (strcmp(rcmd->cmd, "REGISTER") == 0 &&
                strcmp(rcmd->opt, "CONFIRMED") == 0)
            {
                // We got results.. process it .. device_id could be saved.
                cstate->device_id = strdup(rcmd->args[0].val.sval);

                // Save Fog connection state.. the Fog endpoint we are talking to..
                cstate->fog_state.server = strdup(cstate->env->fog_servers[i]);
                cstate->fog_state.port = REQUEST_PORT;
                time_t now = time(&now);
                cstate->fog_state.stime = localtime(&now);

                // Open the sockets.. three in total
                cstate->reqsock = core_socket_to_fog(cstate, SOCKET_REQU);
                cstate->subsock = core_socket_to_fog(cstate, SOCKET_SUBS);
                cstate->respsock = core_socket_to_fog(cstate, SOCKET_RESP);

                return true;
            }
            else
            {
                // got illegal results..
                command_free(rcmd);
                continue;
            }
        }
    }

    // we failed to get a valid connection to a Fog.. so we fail
    return false;
}


/*
 * Try Fog servers in the order specified in the list..
 * Move the non responding Fog servers to the end of the list..
 * There is no need to update the Fog connection state at this point... we do that
 * once the connection is established...
 * We leave the known Fog servers there .. so that we can try them again.
 * The Fog servers could be replaced when we receive a list of potential candidates
 * from the cloud. We only maintain up to MAX_SERVERS at any given time.
 */
bool core_find_fog(corestate_t *cs, int timeout)
{
    int i, k, l;
    int responding[MAX_SERVERS];

    memset(responding, 0, MAX_SERVERS * sizeof(int));

    for (i = 0; i < cs->env->num_fog_servers; i++)  {
        int retries = cs->retries;
        while (retries-- > 0) {
            if (core_ping_jcore(cs->env->fog_servers[i], REQUEST_PORT, cs->device_id, timeout))
                responding[i] = 1;
        }
    }

    int count = 0;
    for (i = 0; i < cs->env->num_fog_servers; i++)
        count += responding[i];
    if (count == 0)
        return false;

    if (count < cs->env->num_fog_servers) {
        // Rearrange the server list.. some servers are not responding..
        k = 0; l = MAX_SERVERS;
        while (k < l) {
            while (responding[k] != 0)
                k++;
            while (responding[l] == 0)
                l--;
            if (k < l) {
                char *kptr = cs->env->fog_servers[k];
                cs->env->fog_servers[k] = cs->env->fog_servers[l];
                cs->env->fog_servers[l] = kptr;
                responding[k] = 1;
                responding[l] = 0;
            }
        }
    }

    return true;
}


bool core_find_fog_from_cloud(corestate_t *cstate, int timeout)
{
    int i;
    bool gotnew = false;

    // Send a "DISCOVER", "FOG" request to the cloud endpoints
    command_t *scmd = command_new("DISCOVER", "FOG", "", 0, "s", cstate->env->app_name);

    for (i = 0; i < cstate->env->num_cloud_servers; i++) {

        // create a request-reply socket
        socket_t *sock = socket_new(SOCKET_REQU);
        socket_connect(sock, cstate->env->cloud_servers[i], REQUEST_PORT);
        socket_send(sock, scmd);

        command_t *rcmd = socket_recv_command(sock, timeout);
        if (rcmd == NULL)
        {
            command_free(rcmd);
            continue;
        }
        else
        {
            if (strcmp(rcmd->cmd, "ADDRESSES") == 0 &&
                strcmp(rcmd->opt, "FOGS") == 0)
            {
                gotnew = true;
                // We got Fog addresses.. insert them into the local database
                // while inserting.. we need to eliminate duplicates.
                // So we only insert new replies..
                for (i = 0; i < rcmd->length; i++) {
                    if (rcmd->args[i].type == STRING_TYPE)
                        core_insert_fog_addr(cstate, rcmd->args[i].val.sval);
                }
                command_free(rcmd);
                continue;
            }
            else
            {
                // got illegal results..
                command_free(rcmd);
                continue;
            }
        }
    }

    // we return the value of gotnew..
    return gotnew;
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

corestate_t *core_init(int timeout)
{
    // create the core state structure..
    corestate_t *cs = (corestate_t *)calloc(1, sizeof(corestate_t));
    // get execution context
    cs->env = get_environ();
    assert(cs->env != NULL);

    return core_do_init(cs, timeout);
}

corestate_t *core_reinit(corestate_t *cs, int timeout)
{
    socket_free(cs->respsock);
    socket_free(cs->respsock);
    socket_free(cs->subsock);

    return core_do_init(cs, timeout);
}

corestate_t *core_do_init(corestate_t *cs, int timeout)
{
    // Try connecting to Fog servers if they are available..
    if (!core_find_fog(cs, timeout)) {
        // if unable to connect to fog, now try the cloud..
        // we need at least the cloud to move forward..

        if (core_find_fog_from_cloud(cs, timeout)) {
            // If the cloud connection is a success we should have new Fog
            // servers in the list.. lets connect to them..
            if (core_connect_to_fog(cs, timeout))
                return cs;
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
    {
        if (core_connect_to_fog(cs, timeout))
            return cs;
        else
            return NULL;
    }
}


// Insert the given address at the beginning of the fog server address
//
void core_insert_fog_addr(corestate_t *cstate, char *host)
{
    int i;

    if (cstate->env->num_fog_servers < MAX_SERVERS)
        cstate->env->num_fog_servers++;

    for (i = cstate->env->num_fog_servers; i > 0; i--)
        cstate->env->fog_servers[i] = cstate->env->fog_servers[i-1];
    cstate->env->fog_servers[0] = strdup(host);
}


socket_t *core_socket_to_fog(corestate_t *cs, int type)
{
    socket_t *sock = socket_new(type);
    socket_create(sock, cs->fog_state.server, cs->fog_state.port);

    return sock;
}
