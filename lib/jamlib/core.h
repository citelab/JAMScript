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
#include <MQTTAsync.h>

#include "mqtt_adapter.h"
#include "command.h"
#include "comboptr.h"

#define MAX_SERVERS             3
#define MAX_PENDING_CNT         500

typedef enum 
{
    SERVER_NOT_REGISTERED,
    SERVER_REG_SENT,
    SERVER_REGISTERED,
    SERVER_ERROR
} server_state_t;

typedef struct _server_t 
{
    server_state_t state;
    char *endpoint;
    bool info_pending;
} server_t;

/*
 * Core data structure. This includes the parameters that are 
 * required to make the basic connections with the J nodes. 
 * MQTT broker information and redis server information go in here. 
 * Also, node identifying information go in here. 
 */
typedef struct _corestate_t
{
    char *device_id;
    char *app_id;
    int serial_num;    
    int mqtt_port;
    server_t *server[MAX_SERVERS];
    mqtt_adapter_t *mqtt[MAX_SERVERS];
    char *redserver;
    int redport;
} corestate_t;


/*
 * Function prototypes
 */

void core_setup(corestate_t *cs);
corestate_t *core_init(int port, int serialnum, char *app_id);
void core_register_sent(corestate_t *cs, int index);
void core_set_registered(corestate_t *cs, int indx, char *epoint);
bool core_is_registered(corestate_t *cs, int indx);
bool core_is_connected(corestate_t *cs, int indx, char *host);
bool core_info_pending(corestate_t *cs);
bool core_pending_isset(corestate_t *cs, int indx);
void core_set_pending(corestate_t *cs, int indx);
void core_set_redis(corestate_t *cs, char *host, int port);
int core_mach_height(corestate_t *cs);

#endif
