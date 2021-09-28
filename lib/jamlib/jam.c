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

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY O9F ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/


#include "jam.h"
#include "core.h"
#include "activity.h"
#include "mqtt_adapter.h"

#ifdef linux
#include <bsd/stdlib.h>
#endif

#include <strings.h>
#include <pthread.h>

int mheight = 1;

int jamport;
int odcount;
list_elem_t *cache;
int cachesize;

extern jamstate_t *js;

/*
 * Initialize the JAMScript library 
 */
jamstate_t *jam_init(int serialnum)
{
    char tagstr[256];
    jamstate_t *js = (jamstate_t *)calloc(1, sizeof(jamstate_t));

    #ifdef DEBUG_LVL1
        printf("JAM Library initialization... \t\t[started]\n");
    #endif
    
    js->cstate = core_init(jamport, serialnum);
    if (js->cstate == NULL)
    {
        printf("ERROR!! Core Init Failed. Exiting.\n");
        exit(1);
    }

    // Initialize the duplicate testing cache with 32 entries
    cache = create_list();
    cachesize = 32;

    // Initialize the overflow detector
    odcount = ODCOUNT_MAX;

    // Initialize the jconditional
    jcond_init();
    jcond_eval_str("var sys = {type: 'device'};");
    jcond_eval_str("var sync = {};");
    jcond_eval_str("var exec = {};");

    if (strlen(dev_tag) > 0)
    {
        sprintf(tagstr, "sys.tag = '%s';", dev_tag);
        jcond_eval_str(tagstr);
    }
    
    jcond_eval_str("function jcondContext(a) { return eval(a); }");

    // Initialization of the activity and task tables
    // This is kind of an hack. There should be a better way structuring the code
    // so that we don't need
    js->atable = activity_table_new(js);
    js->rtable = runtable_new(js);
    // Queue initialization
    // Input side: one for each source: device, fog, cloud
    js->deviceinq = queue_new(false);
    js->foginq = queue_new(false);
    js->cloudinq = queue_new(false);
    // Output queue.. we write to this queue.
    // The jamdata event loop serves from there.
    js->dataoutq = semqueue_new(false);
    js->maintimer = timer_init("maintimer");
    js->synctimer = timer_init("synctimer");

    js->bgsem = threadsem_new();
#ifdef linux
    sem_init(&js->jdsem, 0, 0);
#elif __APPLE__
    char semname[64];
    sprintf(semname, "/jdsem-%d", getpid());
    sem_unlink(semname);
    js->jdsem = sem_open(semname, O_CREAT|O_EXCL, 0644, 0);
    if (js->jdsem == SEM_FAILED)
        perror("sem_open_icount");
#endif

#ifdef DEBUG_LVL1
    printf("Jdata initialization... \t\t[started]\n");
#endif

    int rval;
    rval = pthread_create(&(js->jdthread), NULL, jamdata_init, (void *)js);
    if (rval != 0) {
        perror("ERROR! Unable to start the jamdata thread");
        exit(1);
    }

#ifdef DEBUG_LVL1
    printf("Worker bgthread initialization... \t\t[started]\n");
#endif
    rval = pthread_create(&(js->bgthread), NULL, jwork_bgthread, (void *)js);
    if (rval != 0) {
        perror("ERROR! Unable to start the jamworker thread");
        exit(1);
    }

    // We wait until we get an ack for the REGISTER message from the J side
    task_wait(js->bgsem);

#ifdef DEBUG_LVL1
    printf("JAM Library initialization... \t\t[completed]\n");
#endif

    return js;
}


// Start the background processing loop.
//
//
void jam_event_loop(void *arg)
{
    jamstate_t *js = (jamstate_t *)arg;
    command_t *cmd;
    jactivity_t *jact;
    char *deviceid = js->cstate->device_id;

    mqtt_adapter_t *mq;

    while (1)
    {
        nvoid_t *nv = p2queue_deq(js->atable->globalinq);

        #ifdef DEBUG_LVL1
            printf("Got a message for the event loop...  \n");
        #endif

        if (nv != NULL)
        {
            cmd = (command_t *)nv->data;
            free(nv);

            if (cmd != NULL) {
                switch(cmd->cmd[6]) {
                    case 'A': // 'REXEC-ASY' - checking 6th char of the string..
                        // Remote requests go through here.. local requests don't go through here
                        jact = activity_new(js->atable, cmd->actid, true);

                        // The activity creation should have setup the thread
                        // So we should have a thread to run...
                        //runtable_insert(js, cmd->actid, cmd);

                        if (jact != NULL)
                        {
                            activity_thread_t *athr = athread_getbyindx(js->atable, jact->jindx);
                            pqueue_enq(athr->inq, cmd, sizeof(command_t));
                        }
                    break;
                    case 'S': // 'REXEC-SYN' - checking 6th char of the string..
                        if (strcmp(cmd->opt, "cloud") == 0)
                            mq = js->cstate->mqtt[2];
                        else
                        if (strcmp(cmd->opt, "fog") == 0)
                            mq = js->cstate->mqtt[1];
                        else
                            mq = js->cstate->mqtt[0];

                        // Make a new command which signals to the J node that it's ready
                        // device ID is put in the cmd->actid because I don't know where else to put it.
                        command_t *readycmd = command_new("READY", "READY", "-", 0, "GLOBAL_INQUEUE", deviceid, "_", "");
                        mqtt_publish(mq, "/mach/func/syncrequest", nvoid_new(readycmd->buffer, readycmd->length));
                        command_free(readycmd);
                        double sTime = 0.0;
                        // Wait for the SYNCSTART signal from the J node.
                        nvoid_t *nv = p2queue_deq_high(js->atable->globalinq);
                        command_t *cmd_1;
                        if (nv != NULL) {
                            cmd_1 = (command_t *)nv->data;
                            free(nv);
                        }
                        else cmd_1 = NULL;
                        // printf("Waiting command TYPE: %s\n", cmd_1->cmd);
                        if (cmd_1 != NULL) {
                            if (strcmp(cmd_1->cmd, "SYNCSTART") == 0)
                                // Get the start time from the Go command.
                                sTime = atof(cmd_1->opt);
                            else
                                sTime = 0.0;
                        }
                        command_free(cmd_1);
                        // Remote requests go through here.. local requests don't go through here

                        jactivity_t *jact = activity_new(js->atable, cmd->actid, true);
                        // The activity creation should have setup the thread
                        // So we should have a thread to run...
                        activity_thread_t *athr = athread_getbyindx(js->atable, jact->jindx);
                        runtable_insert(js, cmd->actid, cmd);

                        // Busy waiting until the start time.
                        while (getcurtime() < (double) sTime) {}

                        // printf("after a hwile: %f\n", getcurtime());
                        if (jact != NULL)
                            pqueue_enq(athr->inq, cmd, sizeof(command_t));
                        else
                            printf("ERROR! Unable to find a free Activity handler to start %s", cmd->actname);
                    break;
                    default:
                        printf("===========================SYNC.. TIMEOUT???? %s\n", cmd->cmd);
                    break;
                }
            }
        }
        //taskyield();
    }
}

jactivity_t *jam_create_activity(jamstate_t *js)
{
    char *t = activity_gettime(js->cstate->device_id);
    jactivity_t *j = activity_new(js->atable, t, false);
    free(t);
    return j;
}

bool have_fog_or_cloud(jamstate_t *js)
{
    corestate_t *cs = js->cstate;

    if ((cs->server[1] != NULL) &&
        (cs->server[2] != NULL))
        return ((cs->server[1]->state == SERVER_REGISTERED) ||
                (cs->server[2]->state == SERVER_REGISTERED));
    return false;
}

int requested_level(int cvec)
{
    int level = JCOND_LEVEL_MASK & cvec;
    if (level < 4)
        return level;
    else
        return 3;
}

// maxtime is in milliseconds..
int wait_for_machine(jamstate_t *js, int level, int maxtime)
{
    for (int i = 0; i < maxtime; i++)
    {
        if (core_mach_height(js->cstate) >= level)
            return 1;
        usleep(1000);
    }

    return -1;
}

int jamargs(int argc, char **argv, char *appid, char *tag, int *num)
{
    char *avalue = NULL;
    char *tvalue = NULL;
    char *nvalue = NULL;
    int c;

    // Default port Number
    jamport = 1883;

    opterr = 0;

    while ((c = getopt (argc, argv, "p:a:n:t:h:")) != -1)
        switch (c)
        {
            case 'a':
                avalue = optarg;
            break;
            case 'n':
                nvalue = optarg;
            break;
            case 't':
                tvalue = optarg;
            break;
            case 'p':
                jamport = atoi(optarg);
            break;
            case 'h':
                mheight = atoi(optarg);
            break;
        default:
            printf("ERROR! Argument input error..\n");
            printf("Usage: program -a app_id [-t tag] [-n num] [-p port] [-h height]\n");
            exit(1);
        }

    if (avalue == NULL)
    {
        printf("ERROR! No app name specified. Use -a app_name to specify the app_name\n");
        exit(1);
    }
    strcpy(appid, avalue);

    if (tvalue != NULL)
        strcpy(tag, tvalue);

    if (nvalue != NULL)
        *num = atoi(nvalue);
    else
        *num = 1;

    return optind;
}

// Exported jamlib functions...
//
void jsleep(int ms)
{
    activity_thread_t *athr = athread_getmine(js->atable);

    if (athr != NULL)
    {
        jactivity_t *jact = activity_getbyindx(js->atable, athr->jindx);

        jam_set_timer(js, jact->actid, ms);
        nvoid_t *nv = pqueue_deq(athr->inq);
        jam_clear_timer(js, jact->actid);
        command_free(nv->data);
        free(nv);
    }

}
