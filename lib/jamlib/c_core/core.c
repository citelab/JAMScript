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
    #ifdef DEBUG_MSGS
        printf("Core initialization...");
    #endif

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

    #ifdef DEBUG_MSGS
        printf("\t\t Done\n");
    #endif

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

    #ifdef DEBUG_MSGS
        printf("Core Registration ..... ");
    #endif

    for (i = 0; i < cs->conf->retries; i++)
    {
        core_register_at_fog(cs, timeout);
        if (cs->conf->registered)
        {
    #ifdef DEBUG_MSGS
        printf("\t\t Done\n");
    #endif
            return;
        }
    }

    // TODO: Segfault below.. in the function??
    if (core_find_fog_from_cloud(cs, timeout)) {

        for (i = 0; i < cs->conf->retries; i++)
        {
            core_register_at_fog(cs, timeout);
            if (cs->conf->registered)
            {
    #ifdef DEBUG_MSGS
        printf("\t\t Done\n");
    #endif
                return;
            }
        }
    }

}


bool core_find_fog_from_cloud(corestate_t *cstate, int timeout)
{
    int i;
    bool gotnew = false;

    #ifdef DEBUG_MSGS
        printf("Finding a Fog from Cloud.. \n");
    #endif

    // Send a "DISCOVER", "FOG" request to the cloud endpoints
    command_t *scmd = command_new("DISCOVER", "FOG", "dfdf", "0ddfdf", "dfdfdf", "s", cstate->conf->app_name);

    for (i = 0; i < cstate->conf->num_cloud_servers; i++) {

        // create a request-reply socket
        socket_t *sock = socket_new(SOCKET_REQU);
        socket_connect(sock, cstate->conf->cloud_servers[i], REQUEST_PORT);
        socket_send(sock, scmd);
        command_t *rcmd = socket_recv_command(sock, timeout);
        if (rcmd == NULL)
            continue;
        else
        {
            if (strcmp(rcmd->cmd, "FOUND") == 0 &&
                strcmp(rcmd->opt, "CLOUD") == 0)
            {
                if (rcmd->nargs > 0)
                    gotnew = true;

                // We got Fog addresses.. insert them into the local database
                // while inserting.. we need to eliminate duplicates.
                // So we only insert new replies..
                for (i = 0; i < rcmd->nargs; i++) {
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

    #ifdef DEBUG_MSGS
        printf("Registering the device at the Fog.. ");
    #endif

    scmd = command_new("REGISTER", "DEVICE", cs->conf->app_name, cs->conf->device_id, cs->conf->device_name, "");

    for (i = 0; i < cs->conf->num_fog_servers; i++) {
        // create a request-reply socket
        socket_t *sock = socket_new(SOCKET_REQU);
        socket_connect(sock, cs->conf->fog_servers[i], REQUEST_PORT);
        socket_send(sock, scmd);
        command_t *rcmd = socket_recv_command(sock, timeout);

        if (rcmd != NULL)
        {
            if (strcmp(rcmd->cmd, "REGISTER-ACK") == 0 &&
                strcmp(rcmd->opt, "ORI") == 0)
            {
            #ifdef DEBUG_MSGS
                printf("\t\t Done. Got original registration \n");
            #endif
                if (rcmd->nargs > 0 && rcmd->args[0].type == INT_TYPE)
                {
                    cs->conf->port = rcmd->args[0].val.ival;
                    database_put_int(cs->conf->db, "REQREP_PORT", cs->conf->port);
                    cs->conf->registered = 1;
                    database_put_int(cs->conf->db, "REGISTER-ACK", cs->conf->registered);
                    cs->conf->my_fog_server = cs->conf->fog_servers[i];
                    database_put_string(cs->conf->db, "MY_FOG_SERVER", cs->conf->my_fog_server);

                    command_free(rcmd);
                    command_free(scmd);
                    socket_free(sock);
                    return;
                }
                else
                {
                    printf("WARNING! Malformed REGISTERED reply received.\n");
                    command_free(rcmd);
                    socket_free(sock);
                    continue;
                }
            }
            else
            if (strcmp(rcmd->cmd, "REGISTER-ACK") == 0 &&
                strcmp(rcmd->opt, "ALT") == 0)
            {
            #ifdef DEBUG_MSGS
                printf("\t\t Done. Got alternate registration \n");
            #endif
                // TODO: Anything else here?
                //
                if (rcmd->nargs > 0 && rcmd->args[0].type == INT_TYPE)
                {
                    cs->conf->port = rcmd->args[0].val.ival;
                    database_put_int(cs->conf->db, "REQREP_PORT", cs->conf->port);
                    cs->conf->registered = 1;
                    database_put_int(cs->conf->db, "REGISTER-ACK", cs->conf->registered);
                    cs->conf->my_fog_server = cs->conf->fog_servers[i];
                    database_put_string(cs->conf->db, "MY_FOG_SERVER", cs->conf->my_fog_server);

                    // Get the new device ID and store it as well..
                    if (rcmd->args[1].val.sval != NULL)
                    {
                        free(cs->conf->device_id);
                        cs->conf->device_id = strdup(rcmd->args[1].val.sval);
                        database_put_string(cs->conf->db, "DEVICE_ID", cs->conf->device_id);
                    }

                    command_free(rcmd);
                    command_free(scmd);
                    socket_free(sock);
                    return;
                }
                else
                {
                    printf("WARNING! Malformed REGISTERED reply received.\n");
                    command_free(rcmd);
                    socket_free(sock);
                    continue;
                }
            }
        }
    }
    command_free(scmd);
}


bool core_do_connect(corestate_t *cs, int timeout)
{
    #ifdef DEBUG_MSGS
        printf("Setting up the sockets to the Fog..server - %s:%d\n", cs->conf->my_fog_server, cs->conf->port);
    #endif

    // We already have a port that is allocated for this device.
    // Connect to the Fog at the given port (REQREP)

    cs->reqsock = socket_new(SOCKET_REQU);
    socket_connect(cs->reqsock, cs->conf->my_fog_server, cs->conf->port);

    // Connect to the Fog at the Publish and Survey sockets
    cs->subsock = socket_new(SOCKET_SUBS);
    socket_connect(cs->subsock, cs->conf->my_fog_server, PUBLISH_PORT);

    cs->respsock = socket_new(SOCKET_RESP);
    socket_connect(cs->respsock, cs->conf->my_fog_server, SURVEY_PORT);

    time_t now = time(&now);
    cs->conf->stime = localtime(&now);

    return true;
}
