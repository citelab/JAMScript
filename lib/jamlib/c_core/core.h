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

#ifndef __CORE_H__
#define __CORE_H__

#include <time.h>
#include <stdbool.h>
#include "socket.h"


#define MAX_SERVERS                                 8

// TODO: This is problematic.. do we need these? If so, when should we use them??
#define REQUEST_PORT                                5555
#define SURVEY_PORT                                 6555
#define PUBLISH_PORT                                7555


typedef struct _connect_state_t
{
    char *server;
    int port;                                       // TODO: Dynamically probed
    struct tm *stime;                               // start time of the connection

} connect_state_t;


typedef struct _environ_t
{
    char *cloud_servers[MAX_SERVERS];
    int num_cloud_servers;
    char *fog_servers[MAX_SERVERS];
    int num_fog_servers;
    char *app_name;

} environ_t;


typedef struct _corestate_t
{
    environ_t *env;
    connect_state_t fog_state;
    connect_state_t cloud_state;

    int retries;
    char *device_id;

    socket_t *reqsock;
    socket_t *subsock;
    socket_t *respsock;

} corestate_t;

// ------------------------------
// Function prototypes..
// ------------------------------

// Environment functions...
void print_environ(environ_t *env);
environ_t *get_environ();

// ------------------------------
// Core functions..
// ------------------------------

// Initialize the core.. the first thing we need to call
corestate_t *core_init(int timeout);
corestate_t *core_do_init(corestate_t *cs, int timeout);
corestate_t *core_reinit(corestate_t *cs, int timeout);



// Find a list of respondning Fog endpoints.. no connection made
bool core_find_fog(corestate_t *cstate, int timeout);
// Ask the cloud servers for for endpoints..
bool core_find_fog_from_cloud(corestate_t *cstate, int timeout);

// Connect to the Fog
bool core_connect_to_fog(corestate_t *cstate, int timeout);

// Ping a J core
bool core_ping_jcore();

void core_insert_fog_addr(corestate_t *cstate, char *host);

socket_t *core_socket_to_fog(corestate_t *cs, int type);

#endif
