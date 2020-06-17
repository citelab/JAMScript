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
#include <unistd.h>
#include <dirent.h>
#include <MQTTAsync.h>

#include "core.h"
#include "mqtt_adapter.h"
#include "command.h"
#include "comboptr.h"
#include "uuid4.h"


void core_setup(corestate_t *cs)
{
    DIR *dir = NULL;
    FILE *fp = NULL;
    char portstr[64];
    char machtype[64];
    char fname[64];

    // Spin for at most 60 seconds for the directory to show up
    //
    sprintf(portstr, "%d", cs->mqtt_port);
    for (int i = 0; (i < 60 && dir == NULL); i++)
    {
        dir = opendir(portstr);
        if (dir == NULL) 
            sleep(1);

    }
    if (dir == NULL)
    {
        printf("ERROR! Missing ./%d folder.\n", cs->mqtt_port);
        exit(1);
    }

    sprintf(fname, "./%d/machType", cs->mqtt_port);
    // Spin again if needed for the machType in the directory to show up
    for (int i = 0; (i < 10 && fp == NULL); i++)
    {
        fp = fopen(fname, "r");
        if (fp == NULL)
            sleep(1);
    }
    if (fp == NULL)
    {
        printf("ERROR! Opening the file %s\n", fname);
        exit(1);
    }

    if (fscanf(fp, "%s", machtype) != 1)
    {
        printf("ERROR! Malformed device type in the configuration file\n");
        exit(1);
    }
    if (strcmp(machtype, "device") != 0)
    {
        printf("ERROR! Can't connect C to a J of %s type\n", machtype);
        exit(1);
    }

    sprintf(fname, "./%d/cdevId.%d", cs->mqtt_port, cs->serial_num);
    if (access(fname, F_OK) != -1)
    {
        char devid[UUID4_LEN+1];
        // Get the device ID from the file... check for consistency..
        fp = fopen(fname, "r");

        if (fp == NULL)
        {
            printf("ERROR! Opening the file %s\n", fname);
            printf("Start the J node first and then the C node\n");
            exit(1);
        }
        if (fscanf(fp, "%s", devid) != 1)
        {
            printf("ERROR! Malformed device ID found in the configuration file\n");
            printf("Configuration file at %s is corrupted\n", fname);
            exit(1);
        }

        cs->device_id = strdup(devid);
    }
    else
    {
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

    sprintf(fname, "./%d/cdevProcessId.%d", cs->mqtt_port, cs->serial_num);
    fp = fopen(fname, "w");
    if (fp == NULL)
    {
        printf("ERROR! Unknown permission issue in opening the file %s\n", fname);
        printf("Exiting.\n");
        exit(1);
    }
    fprintf(fp, "%d", getpid());
    closedir(dir);
    fclose(fp);
}


// The core_init() is the bootstrapping function for JAMlib. It runs the MQTT client
// in asynchronous mode - it uses a slightly restricted callback to listen to a subset
// of messages. The restriction is lifted after the core_init() phase is over.
//
corestate_t *core_init(int port, int serialnum, char *app_id)
{
    #ifdef DEBUG_LVL1
        printf("Core initialization...");
    #endif

    // create the core state structure..
    corestate_t *cs = (corestate_t *)calloc(1, sizeof(corestate_t));
    cs->serial_num = serialnum;
    cs->app_id = strdup(app_id);
    cs->mqtt_port = port;
    core_setup(cs);    
    return cs;
}

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