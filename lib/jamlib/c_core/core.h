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
#include "mydb.h"

#define MAX_SERVERS                                 8

// TODO: This is problematic.. do we need these? If so, when should we use them??
#define REQUEST_PORT                                5555
#define SURVEY_PORT                                 7777
#define PUBLISH_PORT                                6666


typedef struct _connect_state_t
{
    char *server;
    int port;                                       // TODO: Dynamically probed
    struct tm *stime;                               // start time of the connection

} connect_state_t;


typedef struct _coreconf_t
{
    mydb_t *db;

    char *cloud_servers[MAX_SERVERS];
    int num_cloud_servers;
    char *fog_servers[MAX_SERVERS];
    int num_fog_servers;

    char *app_name;
    char *device_name;
    char *device_id;
    int retries;

    int registered;
    int port;
    char *my_fog_server;
    struct tm *stime;

} coreconf_t;


typedef struct _corestate_t
{
    coreconf_t *conf;

    socket_t *reqsock[MAX_SERVERS];
    socket_t *subsock[MAX_SERVERS];
    socket_t *respsock[MAX_SERVERS];

    int num_serv;

} corestate_t;

// ------------------------------
// Function prototypes..
// ------------------------------

// Environment functions...
void coreconf_print(coreconf_t *conf);
coreconf_t *coreconf_get();

// ------------------------------
// Core functions..
// ------------------------------

// Initialize the core.. the first thing we need to call
corestate_t *core_init(int timeout);

void core_do_register(corestate_t *cs, int timeout);
bool core_find_fog_from_cloud(corestate_t *cstate, int timeout);
void core_insert_fog_addr(corestate_t *cstate, char *host);
void core_register_at_fog(corestate_t *cs, int timeout);
bool core_do_connect(corestate_t *cs, int timeout);

#endif
