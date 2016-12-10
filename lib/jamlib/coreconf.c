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

#include "core.h"


// Local function prototypes..

bool coreconf_recover(coreconf_t *conf);
coreconf_t *coreconf_make(coreconf_t *conf);

/*
 * Print the core configuration
 */
void coreconf_print(coreconf_t *conf)
{
    int i;

    printf("\n======\n");
    printf("App name: %s\n", conf->app_name);
    for (i = 0; i < conf->num_fog_servers; i++)
        printf("Fog server [%d]: %s\n", i, conf->fog_servers[i]);
    for (i = 0; i < conf->num_cloud_servers; i++)
        printf("Cloud server [%d]: %s\n", i, conf->cloud_servers[i]);
    printf("\n======\n");
}

/*
 * Read the coreconfment variables.
 */
coreconf_t *coreconf_get()
{
    coreconf_t *conf = (coreconf_t *) calloc(1, sizeof(coreconf_t));
    assert(conf != NULL);

    memset(conf, 0, sizeof(coreconf_t));

    if (!coreconf_recover(conf))
        return coreconf_make(conf);

    return conf;
}



bool coreconf_recover(coreconf_t *conf)
{
    conf->db = open_database("jamconf.dat");
    // return false: we were unable to find an old core config file
    if (conf->db == NULL)
        return false;

    // Now recover the configure data
    conf->app_name = database_get_string(conf->db, "APP_NAME");
    conf->device_name = database_get_string(conf->db, "DEVICE_NAME");
    conf->device_id = database_get_string(conf->db, "DEVICE_ID");
    conf->retries = database_get_int(conf->db, "RETRIES");

    conf->num_fog_servers = 1;
    conf->num_cloud_servers = 0;

    conf->fog_servers[0] = strdup("127.0.0.1");
    /*
    conf->num_fog_servers = database_get_int(conf->db, "NUM_FOG_SERVERS");
    conf->num_cloud_servers = database_get_int(conf->db, "NUM_CLOUD_SERVERS");

    for (i = 0; i < conf->num_fog_servers; i++)
    {
        char key[128];
        sprintf(key, "FOG_SERVERS(%d)\n", i);
        conf->fog_servers[i] = database_get_string(conf->db, key);
        printf("Fog server [%d]: %s\n", i, conf->fog_servers[i]);
    }

    for (i = 0; i < conf->num_cloud_servers; i++)
    {
        char key[128];
        sprintf(key, "CLOUD_SERVERS(%d)\n", i);
        conf->cloud_servers[i] = database_get_string(conf->db, key);
        printf("Cloud server [%d]: %s\n", i, conf->cloud_servers[i]);
    }
    */
    conf->registered = database_get_int(conf->db, "REGISTERED");
    if (conf->registered)
    {
        conf->fog_port[0] = database_get_int(conf->db, "REQREP_PORT");
        conf->my_fog_server = database_get_string(conf->db, "MY_FOG_SERVER");
    }

    // TODO: Add new portion of the configuration here..

    return true;
}

char *load_env_param(char *param, char *dvalue)
{
    // Unable to load the specified environment variable? Return the default value...
    char *ptr;
    ptr = getenv(param);
    if (ptr == NULL)
        return strdup(dvalue);
    else
        return strdup(ptr);

    return NULL;
}


// Memory is already allocated for core config. This routine populates it with
// correct values and saves them
//
coreconf_t *coreconf_make(coreconf_t *conf)
{
    int i;

    conf->app_name = load_env_param("APP_NAME", "testapp");
    if (conf->app_name == NULL)
        exit(1);

    conf->device_name = load_env_param("DEVICE_NAME", "testdevice");
    if (conf->device_name == NULL)
        exit(1);

    char buf[128];
    sprintf(buf, "%s|%s", conf->app_name, conf->device_name);
    conf->device_id = strdup(buf);

    conf->retries = 3;

    char *fservers = load_env_param("FOG_SERVERS", "127.0.0.1");
    if (fservers != NULL)
    {
        // find out how many we have in the list.. list is seperated by ':'
        for (i = 0; i < MAX_SERVERS; i++) {
            char *tstr = strsep(&fservers, ":");
            if (tstr != NULL){
                conf->fog_servers[i] = strdup(tstr);
                printf("Fog Servers: %s\n", conf->fog_servers[i]);
            }
            else
                break;
        }
        conf->num_fog_servers = i;
    }
    free(fservers);

    /*
    char *cservers = load_env_param("CLOUD_SERVERS", "127.0.0.1");
    if (cservers != NULL)
    {
        // find out how many we have in the list.. list is seperated by ':'
        for (i = 0; i < MAX_SERVERS; i++) {
            char *tstr = strsep(&cservers, ":");
            if (tstr != NULL){
                conf->cloud_servers[i] = strdup(tstr);
                printf("Cloud Servers: %s\n", conf->cloud_servers[i]);
            }
            else
                break;
        }
        conf->num_cloud_servers = i;
    }
    free(cservers);
    */
    conf->num_cloud_servers = 0;

    if (conf->num_cloud_servers == 0 && conf->num_fog_servers == 0)
    {
        printf("ERROR!! No FOG or CLOUD servers found.\n");
        exit(1);
    }

    // Not registered yet
    conf->registered = 0;

    conf->db = create_database("jamconf.dat", 32, 128);
    // return NULL if the config file cannot be created
    if (conf->db == 0)
        return false;

    database_put_string(conf->db, "APP_NAME", conf->app_name);
    database_put_string(conf->db, "DEVICE_NAME", conf->device_name);
    database_put_string(conf->db, "DEVICE_ID", conf->device_id);
    database_put_int(conf->db, "RETRIES", conf->retries);

    /*
    database_put_int(conf->db, "NUM_FOG_SERVERS", conf->num_fog_servers);
    for (i = 0; i < conf->num_fog_servers; i++)
    {
        char tempkey[128];
        sprintf(tempkey, "FOG_SERVERS(%d)", i);
        database_put_string(conf->db, tempkey, conf->fog_servers[i]);
    }

    database_put_int(conf->db, "NUM_CLOUD_SERVERS", conf->num_cloud_servers);
    for (i = 0; i < conf->num_cloud_servers; i++)
    {
        char tempkey[128];
        sprintf(tempkey, "CLOUD_SERVERS(%d)", i);
        database_put_string(conf->db, tempkey, conf->cloud_servers[i]);
    }*/

    database_put_int(conf->db, "REGISTERED", conf->registered);

    return conf;
}


void register_coreconf(coreconf_t *cc)
{
    cc->registered = 1;
    database_put_int(cc->db, "REGISTERED", cc->registered);
}
