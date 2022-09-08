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
// NO TASKBOARD IN CORE
#include <assert.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
#include <mosquitto.h>
#include "core.h"
#include "tboard.h"
#include "mqtt_adapter.h"
#include "uuid4.h"
#include "snowflake.h"

void core_setup(corestate_t *cs)
{
    FILE *fp = NULL;
    char portstr[64];
    char fname[64];

    sprintf(portstr, "%d", cs->default_mqtt_port);
    // Create the directory if it is not there already
    // No check necessary, just create it.
    mkdir(portstr, 0700); 
    sprintf(fname, "./%d/cdevId.%d", cs->default_mqtt_port, cs->serial_num);
    if (access(fname, F_OK) != -1) {
        char devid[UUID4_LEN+1];
        // Get the device ID from the file... check for consistency..
        fp = fopen(fname, "r");
        if (fp == NULL) {
            printf("ERROR! Opening the file %s\n", fname);
            printf("Start the J node first and then the C node\n");
            exit(1);
        }
        if (fscanf(fp, "%s", devid) != 1) {
            printf("ERROR! Malformed device ID found in the configuration file\n");
            printf("Configuration file at %s is corrupted\n", fname);
            exit(1);
        }
        cs->device_id = strdup(devid);
        fclose(fp);
    }
    else {
        // Create the deviceId and store it..
        char buf[UUID4_LEN];
        uuid4_generate(buf);
        cs->device_id = strdup(buf);
        // Save it under fname..
        fp = fopen(fname, "w");
        if (fp == NULL)
        {
            printf("ERROR! Unknown permission issue in opening the file %s\n", fname);
            printf("Exiting.\n");
            exit(1);
        }
        fprintf(fp, "%s", cs->device_id);
        fclose(fp);
    }

    sprintf(fname, "./%d/cdevProcessId.%d", cs->default_mqtt_port, cs->serial_num);
    fp = fopen(fname, "w");
    if (fp == NULL)
    {
        printf("ERROR! Unknown permission issue in opening the file %s\n", fname);
        printf("Exiting.\n");
        exit(1);
    }
    fprintf(fp, "%d", getpid());
    fclose(fp);
}

corestate_t *core_init(int port, int serialnum, int numexecutors) // remove numexecutors since taskboard is moved
{
    // create the core state structure..
    corestate_t *cs = (corestate_t *)calloc(1, sizeof(corestate_t));
    cs->serial_num = serialnum;
    cs->default_mqtt_port = port;
    core_setup(cs);
    // initialize mqtt 
    mqtt_lib_init();
    // create the task board
    // TODO: move back to cnode
    cs->tboard = tboard_create(cs, numexecutors); // consider moving to cnode
    cs->numservers = 0;

    // TODO: move this to a different location?
    snowflake_init(02, cs->serial_num); // the args: zone, worker-ID - zone is arbitrary 
    return cs;
}

void core_create_server(corestate_t *cs, enum levels level, char *host, int port, char *topics[], int ntopics) 
{
    server_t *serv = (server_t *)calloc(1, sizeof(server_t));
    serv->state = SERVER_NOT_REGISTERED;
    serv->level = level;
    serv->mqtt = setup_mqtt_adapter(serv, level, host, port, topics, ntopics);
    // TODO: remove this as well
    serv->tboard = cs->tboard;
    cs->servers[cs->numservers++] = serv;
}

/* 
 * Find servers at the preferred level.. if no level, then find a server at the edge or
 * return the server at the device level. Cloud is not returned by default.
 */
void find_active_servers(corestate_t *cs, enum levels level, int servers[], int *nservers)
{
    int k = 0;
    for (int i = 0; i < cs->numservers; i++) {
        if (cs->servers[i]->state == SERVER_REGISTERED) {
            if (level > 0 && level == cs->servers[i]->level) 
                servers[k++] = i; 
            else if (level == 0 && cs->servers[i]->level <= EDGE_LEVEL)
                servers[k++] = i;
        }
    }
    *nservers = k;
}

void core_destroy(corestate_t *cs)
{
    // todo: move back to cnode
    tboard_destroy(cs->tboard);
    free(cs->device_id);
    for (int i = 0; i < cs->numservers; i++) {
        disconnect_mqtt_adapter(cs->servers[i]->mqtt);
        destroy_mqtt_adapter(cs->servers[i]->mqtt);
        free(cs->servers[i]);
    }
    free(cs);
}


/*
void core_register_sent(corestate_t *cs, int indx)
{
    if (cs->server[indx] == NULL) 
         cs->server[indx] = (server_t *)calloc(1, sizeof(server_t));
     cs->server[indx]->state = SERVER_REG_SENT; 
}

void core_set_registered(corestate_t *cs, int indx, char *epoint)
{
    if (cs->server[indx] == NULL)
        cs->server[indx] = (server_t *)calloc(1, sizeof(server_t));

    if (cs->server[indx]->state != SERVER_REGISTERED)
    {
        cs->server[indx]->state = SERVER_REGISTERED;
        cs->server[indx]->endpoint = strdup(epoint);
    }
}

bool core_is_registered(corestate_t *cs, int indx)
{
    if ((cs->server[indx] != NULL) &&
        (cs->server[indx]->state == SERVER_REGISTERED))
        return true;
    else 
        return false;
}            

bool core_is_connected(corestate_t *cs, int indx, char *host)
{
    if ((cs->server[indx] != NULL) &&
        (cs->server[indx]->state == SERVER_REGISTERED) && 
        (strcmp(cs->server[indx]->endpoint, host) == 0))
        return true;
    else 
        return false;
}

bool core_info_pending(corestate_t *cs)
{
    bool flag = false;
    for (int i = 0; cs->server[i] != NULL; i++)
        if (cs->server[i]->info_pending)
            flag = true;
    
    return flag;
}

bool core_pending_isset(corestate_t *cs, int indx)
{
    if ((cs->server[indx] != NULL) &&
        (cs->server[indx]->state == SERVER_REGISTERED) &&
        (cs->server[indx]->info_pending == true))
        return true;
    else 
        return false;
}

void core_set_pending(corestate_t *cs, int indx)
{
    if ((cs->server[indx] != NULL) &&
        (cs->server[indx]->state == SERVER_REGISTERED))
        cs->server[indx]->info_pending = true;
}

void core_set_redis(corestate_t *cs, char *host, int port)
{
    cs->redport = port;
    cs->redserver = strdup(host);
}

int core_mach_height(corestate_t *cs)
{
    int i = 0;

    while ((i < 3) && 
           (cs->server[i] != NULL))
        if (cs->server[i]->state == SERVER_REGISTERED)
            i++;
        else 
            break;
    return i;
}
*/