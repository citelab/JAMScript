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

#include "core.h"
#include "mqtt.h"
#include "command.h"
#include "comboptr.h"
#include "uuid4.h"
#include "MQTTAsync.h"


void core_setup(corestate_t *cs, int port)
{
    DIR *dir = NULL;
    FILE *fp = NULL;
    char portstr[64];
    char machtype[64];
    char fname[64];

    // Save the port..
    cs->port = port;

    // Spin for at most 60 seconds for the directory to show up
    //
    sprintf(portstr, "%d", port);
    for (int i = 0; (i < 60 && dir == NULL); i++)
    {
        dir = opendir(portstr);
        sleep(1);
    }

    if (dir == NULL)
    {
        printf("ERROR! Missing ./%d folder.\n", port);
        exit(1);
    }

    sprintf(fname, "./%d/machType", port);
    // Spin again if needed for the machType in the directory to show up
    for (int i = 0; (i < 10 && fp == NULL); i++)
    {
        fp = fopen(fname, "r");
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

    sprintf(fname, "./%d/cdevId.%d", port, cs->serial_num);
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
    sprintf(fname, "./%d/cdevProcessId.%d", port, cs->serial_num);
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


// The core_init() is the bootstrapping function for JAMlib. It runs the MQTT client
// in asynchronous mode - it uses a slightly restricted callback to listen to a subset
// of messages. The restriction is lifted after the core_init() phase is over.
//

corestate_t *core_init(int port, int serialnum)
{
    #ifdef DEBUG_LVL1
        printf("Core initialization...");
    #endif

    // create the core state structure..
    corestate_t *cs = (corestate_t *)calloc(1, sizeof(corestate_t));
    // device_id set inside the following function
    cs->cf_pending = true;
    cs->serial_num = serialnum;

    // redserver and redport are already initialized to NULL and 0, respectively
    //
    core_setup(cs, port);
    return cs;
}



void core_createserver(corestate_t *cs, int indx, char *url)
{
    // If we are trying to create the previous server... just return!
    // This happens because the server previously connected became available after
    // a disconnection..
    if (cs->mqtthost[indx] != NULL && strcmp(cs->mqtthost[indx], url) == 0)
        return;

    cs->mqtthost[indx] = strdup(url);

    // open an mqtt connection to localhost
    cs->mqttserv[indx] = mqtt_create(cs->mqtthost[indx]);

    if (cs->mqttserv[indx] == NULL)
    {
        printf("WARNING! Cannot create MQTT endpoint at %s\n", url);
        printf("Could be an error in the endpoint discovered or configured at %s.\n", cs->mqtthost[0]);
    }

//    cs->mqttenabled[indx] = false;
}


void core_connect(corestate_t *cs, int indx, void (*onconnect)(void *, MQTTAsync_successData *), char *hid)
{
    int rc;

    MQTTAsync_connectOptions conn_opts = MQTTAsync_connectOptions_initializer;
    conn_opts.keepAliveInterval = 20;
    conn_opts.cleansession = 1;
    conn_opts.onSuccess = onconnect;
    conn_opts.context = cs;
    conn_opts.onFailure = NULL;

    rc = MQTTAsync_connect(cs->mqttserv[indx], &conn_opts);

    if ((rc != MQTTASYNC_SUCCESS) && (indx == 0))
    {
        printf("\nERROR! Unable to connect to the MQTT server at [%s].\n", cs->mqtthost[indx]);
        printf("** Check whether an MQTT server is running at [%s] **\n\n", cs->mqtthost[indx]);
        exit(1);
    }
    else if ((rc != MQTTASYNC_SUCCESS) && (indx != 0))
    {
        printf("\nWARNING! Unable to reconnect to the MQTT server at [%s].\n", cs->mqtthost[indx]);
        printf("** Check whether an MQTT server is running at [%s] **\n\n", cs->mqtthost[indx]);
        printf("Device could have moved away from the fog connection zone.\n");
    }

    // We are saving the eventual host that would be connected here.
    // The connection won't be alive until the on-X-connect() handler is fired
    //
    if (hid != NULL)
        cs->hid[indx] = strdup(hid);
}

void core_sethost(corestate_t *cs, int indx, char *hid)
{
    if (hid != NULL)
        cs->hid[indx] = strdup(hid);
}

bool core_disconnect(corestate_t *cs, int indx, char *hid)
{
    int rc;

    // If this is a stray disconnection request, we should just ignore it.
    // Only valid request is the server (fog, cloud, device) we are connected to...
    if ((cs->mqttenabled[indx]) &&
        (cs->hid[indx] != NULL) &&
        (strcmp(cs->hid[indx], hid) != 0))
            return false;
    // release the old one..
    free(cs->hid[indx]);
    cs->hid[indx] = NULL;

    MQTTAsync_disconnectOptions dconn_opts = MQTTAsync_disconnectOptions_initializer;
    dconn_opts.timeout = 0;
    dconn_opts.onSuccess = NULL;
    dconn_opts.context = cs;
    dconn_opts.onFailure = NULL;

    rc = MQTTAsync_disconnect(cs->mqttserv[indx], &dconn_opts);

    printf("Core.. disconnected... %s\n", cs->mqtthost[indx]);
    cs->mqttenabled[indx] = false;

    return true;
}


void core_setcallbacks(corestate_t *cs, comboptr_t *ctx,
        MQTTAsync_connectionLost *cl,
        MQTTAsync_messageArrived *ma,
        MQTTAsync_deliveryComplete *dc)
{
    MQTTAsync_setCallbacks(cs->mqttserv[ctx->iarg], ctx, cl, ma, dc);
}



void core_set_subscription(corestate_t *cs, int level)
{
    if (!cs->mqttenabled[level])
        return;

    mqtt_subscribe(cs->mqttserv[level], "/admin/announce/all");
    mqtt_subscribe(cs->mqttserv[level], "/level/func/reply/#");
    mqtt_subscribe(cs->mqttserv[level], "/mach/func/request");
            // Subscribe to the "go" topic for sync purpose.
    mqtt_subscribe(cs->mqttserv[level], "/admin/request/go");
}


void core_check_pending(corestate_t *cs)
{
    bool flag = false;
    for (int i = 0; i < mheight; i++)
        if (!cs->mqttenabled[i])
            flag = true;

    // cf_pending is true if we are still seeking information.
    cs->cf_pending = flag;
}
