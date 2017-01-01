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
#include <MQTTClient.h>

#define MAX_SERVERS             3

typedef struct _corestate_t
{
    char *device_id;

    // TODO: May be unused? Can we remove this one??
    int timeout;

    MQTTClient mqttserv[3];
    bool mqttenabled[3];

} corestate_t;

typedef struct  _corecontext_t
{
    int xx;

} corecontext_t;

// ------------------------------
// Function prototypes..
// ------------------------------

// Initialize the core.. the first thing we need to call
corestate_t *core_init(int port, int timeout);
void core_setup(corestate_t *cs, int timeout);
void core_reinit(corestate_t *cs);

void core_disconnect(corestate_t *cs);
void core_reconnect(corestate_t *cs);

#endif
