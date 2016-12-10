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
#include "mqtt.h"
#include "uuid4.h"
#include "command.h"


corestate_t *core_init(int timeout)
{
    command_t *scmd;

    #ifdef DEBUG_MSGS
        printf("Core initialization...");
    #endif

    // create the core state structure..
    corestate_t *cs = (corestate_t *)calloc(1, sizeof(corestate_t));
    core_setup(cs);

    // open an mqtt connection to localhost
    cs->mqttserv[0] = mqtt_open("mqtt://localhost");
    if (cs->mqttserv[0] == NULL)
    {
        printf("ERROR! Unable to connect to the MQTT server at localhost..\n");
        exit(1);
    }

    // send register message
    scmd = command_new("REGISTER", "DEVICE", cs->app_name, "-", cs->device_id);
    mqtt_publish(cs->mqttserv[0], "/admin/request/all", scmd); 
    command_free(scmd);
    // get the register acknowledge message 
    if ((rcmd = mqtt_receive(cs->mqttserv[0], "REGISTER-ACK", "/admin/announce/all", cs->timeout)) == NULL) 
    {
        // if the acknowledege timed out or registration failed.. report it.
        printf("ERROR! No acknowledgement from the broker for registration..");
        exit(1);
    }
    command_free(rcmd);
    cs->mqttenabled[0] = TRUE;

    // get information about the machine state: fog address, cloud address
    scmd = command_new("GET-CF-INFO", "DEVICE", cs->app_name, "-", cs->device_id);
    mqtt_publish(cs->mqttserv[0], "/admin/request/all", scmd); 
    if ((rcmd = mqtt_receive(cs->mqttserv[0], "PUT-CF-INFO", "/admin/announce/all", cs->timeout)) == NULL) 
    {
        // Unable to get fog/cloud status from the broker..
        printf("ERROR! Unable to get cloud/fog status information.. ");
        exit(1);
    } else
    {
        // process the information that we just received..
        for (int i = 0; i < rcmd->nargs; i++) 
        {
            char target[64];
            sprintf(target, "mqtt://%s", rcmd->args[0].val->sval);
            cs->mqttserv[i+1] = mqtt_open(target);
            if (cs->mqttserv[i+1] != NULL) 
            {
                scmd = command_new("REGISTER", "DEVICE", cs->app_name, "-", cs->device_id);
                mqtt_publish(cs->mqttserv[i+1], "/admin/request/all", scmd); 
                command_free(scmd);
    
                // get the register acknowledge message 
                if ((rcmd = mqtt_receive(cs->mqttserv[i+1], "REGISTER-ACK", "/admin/announce/all", cs->timeout)) == NULL)
                    cs->mqttenabled[i+1] = FALSE;
                else
                    cs->mqttenabled[i+1] = TRUE;
            }
        }
    }

    // We need to turn on the Asynchronous mode in the MQTT client...
    // This could be done later.. when we know the callbacks
    return cs;
}


void core_setup(corestate_t *cs)
{
    // TODO: set the app_name properly
    cs->app_name = strdup("APP_NAME");

    char buf[UUID4_LEN];
    uuid4_generate(buf);
    cs->device_id = strdup(buf);
}


// We are trying to do re-initialization because the connection is lost 
// We could have inferred this through a callback trigger
//
// TODO: We need have a core reinitialization routine. The challenge
// here is to handle the reply in the asynchronous mode. We need to create a
// local context and let the handlers update that context. We need to have asynchronous 
// receive routines that would actually receive from the local context. Check the local
// context for the completion of the reception. Get the message from there. Use a sleep 
// in the receiver to check. 
// 
void core_reinit(corestate_t *cs)
{
    int i;
    command_t *scmd;
    corecontext_t *ctx;

    corecontext_t *ctx = (corecontext_t *)calloc(1, sizeof(corecontext_t));

    // Reset the callback handlers
    for (i = 0; i < 3; i++)
        MQTTClient_setCallbacks(cs->mqttserv[i], ctx, core_connlost, core_msgarr, core_delcomp);

    for (i = 0; i < 3; i++) 
    {
        // send a ping message
        scmd = command_new("PING", "DEVICE", cs->app_name, "-", cs->device_id);
        mqtt_publish(cs->mqttserv[i], "/admin/request/all", scmd);

    }
    // TODO: This is totally incomplete.
}

