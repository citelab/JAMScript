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


#define new_buffer(x)           (char *)calloc(x, sizeof(char))
void recover_string_data(mydb_t *db, char *key, char **data)
{
    *data = new_buffer(db->state.datalen);
    database_get(db, key, *data);
}

void recover_int_data(mydb_t *db, char *key, int *data)
{
    database_get(db, key, data);
}





bool coreconf_recover(coreconf_t *conf)
{
    int i;

    conf->db = open_database("jamconf.dat");
    // return false: we were unable to find an old core config file
    if (conf->db == NULL)
        return false;

    // Now recover the configure data
    recover_string_data(conf->db, "APP_NAME", &conf->app_name);
    recover_string_data(conf->db, "DEVICE_NAME", &conf->device_name);
    recover_string_data(conf->db, "DEVICE_ID", &conf->device_id);

    recover_int_data(conf->db, "NUM_FOG_SERVERS", &conf->num_fog_servers);
    recover_int_data(conf->db, "NUM_CLOUD_SERVERS", &conf->num_cloud_servers);

    for (i = 0; i < conf->num_fog_servers; i++)
    {
        char key[128];
        sprintf(key, "FOG_SERVERS(%d)", i);
        recover_string_data(conf->db, key, &conf->fog_servers[i]);
    }

    for (i = 0; i < conf->num_cloud_servers; i++)
    {
        char key[128];
        sprintf(key, "CLOUD_SERVERS(%d)", i);
        recover_string_data(conf->db, key, &conf->cloud_servers[i]);
    }

    recover_int_data(conf->db, "REGISTERED", &conf->registered);
    if (conf->registered)
    {
        recover_int_data(conf->db, "REQREP_PORT", &conf->registered);
        recover_string_data(conf->db, "MY_FOG_SERVER", &conf->my_fog_server);
    }

    // TODO: Add new portion of the configuration here..

    return true;
}

char *load_env_param(char *param, char *emsg)
{
    char *ptr;
    ptr = getenv(param);
    if (ptr == NULL)
        printf("%s\n", emsg);
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

    conf->app_name = load_env_param("APP_NAME", "ERROR!! APP_NAME should be set.");
    if (conf->app_name == NULL)
        exit(1);

    conf->device_name = load_env_param("DEVICE_NAME", "ERROR!! DEVICE_NAME should be set.");
    if (conf->device_name == NULL)
        exit(1);

    char buf[128];
    sprintf(buf, "%s|%s", conf->app_name, conf->device_name);
    conf->device_id = strdup(buf);

    conf->retries = 3;

    char *fservers = load_env_param("FOG_SERVERS", "WARNING! No FOG_SERVERS set.");
    if (fservers != NULL)
    {
        // find out how many we have in the list.. list is seperated by ':'
        for (i = 0; i < MAX_SERVERS; i++) {
            char *tstr = strsep(&fservers, ":");
            if (tstr != NULL)
                conf->fog_servers[i] = strdup(tstr);
            else
                break;
        }
        conf->num_fog_servers = i;
    }
    free(fservers);

    char *cservers = load_env_param("CLOUD_SERVERS", "WARNING! No CLOUD_SERVERS set.");
    if (cservers != NULL)
    {
        // find out how many we have in the list.. list is seperated by ':'
        for (i = 0; i < MAX_SERVERS; i++) {
            char *tstr = strsep(&cservers, ":");
            if (tstr != NULL)
                conf->cloud_servers[i] = strdup(tstr);
            else
                break;
        }
        conf->num_cloud_servers = i;
    }
    free(cservers);

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

    database_put(conf->db, "APP_NAME", conf->app_name);
    database_put(conf->db, "DEVICE_NAME", conf->device_name);
    database_put(conf->db, "DEVICE_ID", conf->device_id);
    database_put(conf->db, "RETRIES", &conf->retries);

    database_put(conf->db, "NUM_FOG_SERVERS", (void *)&conf->num_fog_servers);
    for (i = 0; i < conf->num_fog_servers; i++)
    {
        char tempkey[128];
        sprintf(tempkey, "FOG_SERVERS(%d)", i);
        database_put(conf->db, tempkey, conf->fog_servers[i]);
    }

    database_put(conf->db, "NUM_CLOUD_SERVERS", (void *)&conf->num_cloud_servers);
    for (i = 0; i < conf->num_cloud_servers; i++)
    {
        char tempkey[128];
        sprintf(tempkey, "CLOUD_SERVERS(%d)", i);
        database_put(conf->db, tempkey, conf->cloud_servers[i]);
    }

    database_put_sync(conf->db, "REGISTERED", (void *)&conf->registered);

    return conf;
}


void register_coreconf(coreconf_t *cc)
{
    cc->registered = 1;
    database_put_sync(cc->db, "REGISTERED", (void *)&cc->registered);
}
