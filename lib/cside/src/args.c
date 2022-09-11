#include "cnode.h"
#include "args.h"

#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>

#include "utilities.h"

bool args_port_valid(int port){
    return (PORT_MIN <= port <= PORT_MAX);
}
bool args_serialnum_valid(int serialnum){
    return (serialnum > 0);
}
bool args_numexecutors_valid(int numexecutors){
    return (numexecutors >= 0);
}

cnode_args_t *process_args(int argc, char **argv) {
    cnode_args_t *args = (cnode_args_t *)malloc(sizeof(cnode_args_t));

    args->argc = argc;
    args->argv = calloc(argc, sizeof(char *));

    for (int i=0; i<argc; i++) {
        // the following part is only necessary for user inputted data
        if(argv[i] == NULL) {
            args->argc = i;
            break;
        }
        // allocate buffer to hold argument, then copy argument
        args->argv[i] = calloc(strlen(argv[i])+1, sizeof(char));
        strcpy(args->argv[i], argv[i]);

        /////// begin processing. //////////
        // The first argument should always be port number
        if (i == 1) {
            args->port = atoi(args->argv[i]);
        }
        // if second argument is supplied, it will be serial number
        if (i == 2) {
            args->serialnum = atoi(args->argv[i]);
        }
        // if third argument is supplied, it will be number of tboard executors
        if (i == 3) {
            args->numexecutors = atoi(args->argv[i]);
        }
    }
    // here we place the default arguments
    if (args->argc <= 1) { // no port given
        args->port = DEFAULTS_PORT;
    }
    if (args->argc <= 2) {
        args->serialnum = DEFAULTS_SERIALNUM;
    }
    if (args->argc <= 3) {
        args->numexecutors = DEFAULTS_NUMEXECUTORS;
    }
    // check validity
    if ( !args_port_valid(args->port) ) {
        destroy_args(args);
        terminate_error(false, "Invalid port given %d",args->port);
        
        return NULL;
    }
    if ( !args_serialnum_valid(args->serialnum) ) {
        destroy_args(args);
        terminate_error(false, "Invalid serial number given %d",args->serialnum);
        
        return NULL;
    }
    if ( !args_numexecutors_valid(args->numexecutors) ){
        destroy_args(args);
        terminate_error(false, "Invalid number of executors given %d",args->numexecutors);
        
        return NULL;
    }
    return args;
}


void destroy_args(cnode_args_t *args) {
    // free each argument string
    for (int i=0; i<args->argc; i++) {
        free(args->argv[i]);
    }
    // free argument pointers
    free(args->argv);
    // free arguments object
    free(args);
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


/*
MQTT_info_t *find_dev_j(cnode_core_group_t *group) {
    MQTT_info_t *servinfo = (MQTT_info_t *)malloc(sizeof(MQTT_info_t));

    // This is a dummy implementation. User input that exceeds buffer length WILL SEGFAULT
    //sprintf((servinfo->connection), "%s@%s:%d", group->user, group->IP, group->port);
    //sprintf((servinfo->authentication), "%s", group->pass);

    return servinfo;
}

void destroy_dev_j(MQTT_info_t *info) {
    if(info != NULL)
        free(info);
}
*/