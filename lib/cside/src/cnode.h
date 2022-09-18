#ifndef __CNODE_H__
#define __CNODE_H__

#include "tboard.h"
#include "mqtt_adapter.h"
#include "core.h"

#define MAX_SERVERS             16
#define MAX_TOPICS              16

typedef enum
{
    SERVER_NOT_REGISTERED,
    SERVER_REG_SENT,
    SERVER_REGISTERED,
    SERVER_ERROR
} server_state_t;

typedef struct _server_t 
{
    enum levels level;
    server_state_t state;
    mqtt_adapter_t *mqtt;
    tboard_t *tboard;
    // redis_adapter goes here 
} server_t;

typedef struct _topics_t
{
    char *list[MAX_TOPICS];
    int length;
} topics_t;

/* CNode arguments structure created by process_args() */
typedef struct cnode_args_t {
    char *tags;
    int groupid;
    char *appid;
    int port;
    int snumber;
    int nexecs;
} cnode_args_t;


/* CNode type, which contains CNode substructures and taskboard */
typedef struct cnode_t {
    cnode_args_t *args;
    topics_t *topics;
    corestate_t *core;
    server_t *devjserv;
    broker_info_t *devjinfo;
    tboard_t *tboard;
} cnode_t;



/************************
 * Function Definitions *
 ************************/

/////////////////////////////////////////
//////////////// CNODE //////////////////
/////////////////////////////////////////
cnode_t *cnode_init(int argc, char **argv); // cnode.c
/** cnode_init() - Initializes CNode
 * @argc: argument count
 * @argv: arguments pointer
 * 
 * Initializes CNode essentially
 * 
 * Creates args, core, and dev_j structures, and initializes taskboard
 * 
 * Returns: cnode_t pointer to initialized cnode on success
 *          NULL on failure
 * 
 * Context: throws terminate_error() on error
 *          allocates returned pointer
 */

void cnode_destroy(cnode_t *cn); // cnode.c
/** cnode_destroy() - Initializes CNode
 * @cn: CNode to destroy
 * 
 * Destroys cnode
 * 
 * Frees all objects created by CNode initializer, 
 * 
 * Returns: Nothing
 * 
 * Context: Frees all objects
 */



bool cnode_start(cnode_t *cn); // cnode.c
/** cnode_init() - Initializes CNode
 * @cn: CNode Pointer to start
 * 
 * Starts CNode
 * 
 * Starts MQTT server if applicable, otherwise it connects?
 * Starts task board
 * 
 * 
 * Returns: True on success
 *          False on failure
 * 
 * Context: should most likely throw terminate_error() on error, but this would likely not be memory safe
 */

bool cnode_stop(cnode_t *cn);




////////////////////////////////////////
//////////////// ARGS //////////////////
////////////////////////////////////////
cnode_args_t *process_args(int argc, char **argv); // args.c
/** process_args() - Processes arguments
 * @argc: argument count
 * @argv: arguments pointer
 * 
 * Processes arguments and generates cnode_args_t type
 * 
 * 
 * Returns: cnode_args_t pointer on success
 *          NULL on failure
 * 
 * Context: Allocates return pointer
 */

void destroy_args(cnode_args_t *args); // args.c
/** destroy_args() - Destroys arguments
 * @args: arguments object generated by process_args()
 * 
 * destroys arguments on destruction of cnode
 * 
 * Returns: void
 * 
 * Context: Dellocates cnode_args_t pointer and any other allocations of process_args()
 */


#endif