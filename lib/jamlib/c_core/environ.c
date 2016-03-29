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


/*
 * Print the environment
 */
void print_environ(environ_t *env)
{
    int i;

    printf("\n======\n");
    printf("App name: %s\n", env->app_name);
    for (i = 0; i < env->num_fog_servers; i++)
        printf("Fog server [%d]: %s\n", i, env->fog_servers[i]);
    for (i = 0; i < env->num_cloud_servers; i++)
        printf("Cloud server [%d]: %s\n", i, env->cloud_servers[i]);
    printf("\n======\n");
}

/*
 * Read the environment variables.
 */
environ_t *get_environ()
{
    int i;

    environ_t *env = (environ_t *) calloc(1, sizeof(environ_t));
    assert(env != NULL);

    memset(env, 0, sizeof(environ_t));

    // get the app_name
    env->app_name = getenv("APP_NAME");
    if (env->app_name == NULL) {
        printf("FATAL ERROR!! APP_NAME is not set..\n");
        exit(1);
    }

    // get the fog servers
    char *fservers = getenv("FOG_SERVERS");
    printf("Fog serrver %s\n", fservers);
    if (fservers != NULL) {
        // find out how many we have in the list.. list is seperated by ':'
        for (i = 0; i < MAX_SERVERS; i++) {
            char *tstr = strsep(&fservers, ":");
            if (tstr != NULL)
                env->fog_servers[i] = strdup(tstr);
            else
                break;
        }
        env->num_fog_servers = i;
    }

    char *cservers = getenv("CLOUD_SERVERS");
    printf("Cloud serrver %s\n", cservers);
    if (cservers != NULL) {
        // find out how many we have in the list.. list is seperated by ':'
        for (i = 0; i < MAX_SERVERS; i++) {
            char *tstr = strsep(&cservers, ":");
            if (tstr != NULL)
                env->cloud_servers[i] = strdup(tstr);
            else 
                break;
        }
        env->num_cloud_servers = i;
    }

    return env;
}
