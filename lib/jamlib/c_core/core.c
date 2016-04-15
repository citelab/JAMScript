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



corestate_t *core_init(int timeout)
{
    // create the core state structure..
    corestate_t *cs = (corestate_t *)calloc(1, sizeof(corestate_t));
    // get core configuration
    cs->conf = coreconf_get();
    if (cs->conf == NULL)
    {
        printf("ERROR!! Unable to create or recover configuration.\n");
        exit(1);
    }


    if (!cs->conf->registered)
        core_do_register(cs, timeout);

    if (cs->conf->registered)
    {
        if (!core_do_connect(cs, timeout))
        {
            printf("ERROR!! Unable to connect to the Fog.\n");
            exit(1);
        }
    }
    else
    {
        printf("ERROR!! Unable to register to the Fog.\n");
        exit(1);
    }

    return cs;
}



// This function does not need to have a return value
// The 'registered' parameter in the config. holds the state value
// Also, that value is stored in the key-value store. So we are good
// for persistence.
//
void core_do_register(corestate_t *cs, int timeout)
{
    int i;

    for (i = 0; i < cs->conf->retries; i++)
    {
        core_register_at_fog(cs, timeout);
        if (cs->conf->registered)
            return;
    }

    if (core_find_fog_from_cloud(cs, timeout)) {

        for (i = 0; i < cs->conf->retries; i++)
        {
            core_register_at_fog(cs, timeout);
            if (cs->conf->registered)
                return;
        }
    }
}


bool core_find_fog_from_cloud(corestate_t *cstate, int timeout)
{
    int i;
    bool gotnew = false;

    // Send a "DISCOVER", "FOG" request to the cloud endpoints
    command_t *scmd = command_new("DISCOVER", "FOG", "", 0, "s", cstate->conf->app_name);

    for (i = 0; i < cstate->conf->num_cloud_servers; i++) {

        // create a request-reply socket
        socket_t *sock = socket_new(SOCKET_REQU);
                printf("Hello 1\n");
        socket_connect(sock, cstate->conf->cloud_servers[i], REQUEST_PORT);
                printf("Hello 2\n");
        socket_send(sock, scmd);
        printf("Hello 3\n");
        command_t *rcmd = socket_recv_command(sock, timeout);
        if (rcmd == NULL)
            continue;
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



// Insert the given address at the beginning of the fog server address
//
void core_insert_fog_addr(corestate_t *cstate, char *host)
{
    int i;

    if (cstate->conf->num_fog_servers < MAX_SERVERS)
        cstate->conf->num_fog_servers++;

    for (i = cstate->conf->num_fog_servers; i > 0; i--)
        cstate->conf->fog_servers[i] = cstate->conf->fog_servers[i-1];
    cstate->conf->fog_servers[0] = strdup(host);
}


void core_register_at_fog(corestate_t *cs, int timeout)
{
    int i;
    command_t *scmd;

    scmd = command_new("REGISTER", "DEVICE", cs->conf->app_name, cs->conf->device_name, "s", cs->conf->device_id);

    for (i = 0; i < cs->conf->num_fog_servers; i++) {

        // create a request-reply socket
        socket_t *sock = socket_new(SOCKET_REQU);
        socket_connect(sock, cs->conf->fog_servers[i], REQUEST_PORT);
        socket_send(sock, scmd);

        command_t *rcmd = socket_recv_command(sock, timeout);
        socket_free(sock);
        if (rcmd == NULL)
        {
            command_free(rcmd);
            continue;
        }
        else
        {
            if (strcmp(rcmd->cmd, "REGISTERED") == 0 &&
                strcmp(rcmd->opt, "ORI") == 0)
            {
                if (rcmd->nargs > 0 && rcmd->args[0].type == INT_TYPE)
                {
                    cs->conf->port = rcmd->args[0].val.ival;
                    database_put(cs->conf->db, "REQREP_PORT", &cs->conf->port);
                    cs->conf->registered = 1;
                    database_put_sync(cs->conf->db, "REGISTERED", &cs->conf->registered);
                    return;
                }
                else
                {
                    printf("WARNING! Malformed REGISTERED reply received.\n");
                    continue;
                }
            }
            else
            if (strcmp(rcmd->cmd, "REGISTERED") == 0 &&
                strcmp(rcmd->opt, "ALT") == 0)
            {
                // TODO: Anything else here?
                //
                if (rcmd->nargs > 0 && rcmd->args[0].type == INT_TYPE)
                {
                    cs->conf->port = rcmd->args[0].val.ival;
                    database_put(cs->conf->db, "REQREP_PORT", &cs->conf->port);
                    cs->conf->registered = 1;
                    database_put_sync(cs->conf->db, "REGISTERED", &cs->conf->registered);

                    // Get the new device ID and store it as well..
                    if (rcmd->args[1].val.sval != NULL)
                        cs->conf->device_id = strdup(rcmd->args[1].val.sval);

                    return;
                }
                else
                {
                    printf("WARNING! Malformed REGISTERED reply received.\n");
                    continue;
                }
            }
        }
    }
}


bool core_do_connect(corestate_t *cs, int timeout)
{
    // We already have a port that is allocated for this device.
    // Connect to the Fog at the given port (REQREP)
    cs->reqsock = socket_new(SOCKET_REQU);
    socket_create(cs->reqsock, cs->conf->my_fog_server, cs->conf->port);

    // Connect to the Fog at the Publish and Survey sockets
    cs->subsock = socket_new(SOCKET_SUBS);
    socket_create(cs->subsock, cs->conf->my_fog_server, PUBLISH_PORT);

    cs->respsock = socket_new(SOCKET_RESP);
    socket_create(cs->respsock, cs->conf->my_fog_server, SURVEY_PORT);

    time_t now = time(&now);
    cs->conf->stime = localtime(&now);

    return true;
}
