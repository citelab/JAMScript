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
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
#include "core.h"
#include "uuid4.h"

void core_setup(corestate_t *cs)
{
    FILE *fp = NULL;
    char portstr[64];
    char fname[64];

    snprintf(portstr, 64, "%d", cs->default_mqtt_port);
    // Create the directory if it is not there already
    // No check necessary, just create it.
    mkdir(portstr, 0700); 
    snprintf(fname, 64, "./%d/cdevId.%d", cs->default_mqtt_port, cs->serial_num);
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

    snprintf(fname, 64, "./%d/cdevProcessId.%d", cs->default_mqtt_port, cs->serial_num);
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

corestate_t *core_init(int port, int serialnum) 
{
    // create the core state structure..
    corestate_t *cs = (corestate_t *)calloc(1, sizeof(corestate_t));
    cs->serial_num = serialnum;
    cs->default_mqtt_port = port;
    core_setup(cs);
    return cs;
}

void core_destroy(corestate_t *cs)
{
    free(cs->device_id);
    free(cs);
}
