#include <czmq.h>
#include "jobject.h"
#include "jmsg.h"
#include "bloom.h"



typedef struct _jobjmanager
{
    zsock_t *pipe;
    zhash_t *cache;
    bool verbose;
    bool terminated;
    int numofobjs;
    jobject_t *objs;
    int *miscount;
    int *poscount;

} jobjmanager_t;


/*
 * Local function prototypes..
 */

void handle_pipe(jobjmanager_t *self, void *msg);
void process_hello_msg(jobjmanager_t *self, void *msg);
void broadcast_hello_msg(jobjmanager_t *self);
void process_lan_msg(jobjmanager_t *self);
void process_wan_msg(jobjmanager_t *self);
jobjmanager_t *create_jobjmanager(zsock_t *pipe);


void handle_pipe(jobjmanager_t *self, void *msg)
{
    char *cmd = zstr_recv(self->pipe);

    // All messages handled by the jobjmanager is over here.
    if (streq(cmd, "VERBOSE"))
        self->verbose = true;
    else
    if (streq(cmd, "FLUSHCACHE"))
        flushcache(self->cache);
    else
    if (streq(cmd, "HELLO"))
        process_hello_msg(self, msg);           // HELLO came in.. we need to process it.
    else
    if (streq(cmd, "SAYHELLO"))
        broadcast_hello_msg(self);              // We got a trigger to generate a HELLO
    else
    if (streq(cmd, "LAN_MSG"))
        process_lan_msg(self);                  // LAN_MSG came in.. we need to process it..
    else
    if (streq(cmd, "WAN_MSG"))
        process_gossip(self, msg);              // WAN_MSG came in.. we need to process it..
    else
    if (streq(cmd, "PING"))
        do_ping_reply(pipe);                    // Reply with a PONG..
    else
    if (streq(cmd, "$TERM"))
        self->terminated = true;
}


void do_ping_reply(jobjmanager_t *self)
{
    printf("PING received...");
    zstr_sendx(pipe, "PONG", NULL);
}


void flush_cache(jobjmanager_t *self)
{
    // TODO: Is there a better way of flushing the cache?
    // This is kind of stupid.. we are destroying and recreating the cache..
    //
    zhash_destroy(&(self->cache));
    self->cache = zhash_new();
    zhash_autofree(self->cache);
}

// Get the incoming message and update the local tables..
void process_hello_msg(jobjmanager_t *self, void *arg)
{
    jmsg_t *msg = (jmsg_t *)arg;

    // messages are pushed.. you cannot pull messages because you don't know
    // what you are missing.. the bloom filter can be checked for contain/not-contain of
    // a particular message

    struct bloom *bfilter = (struct bloom *)msg->payload;

    for(int i = 0; i < self->numofobjs; i++) {
        if (bloom_check(bfilter, &(self->objs[i]), sizeof(jobject_t)))
            self->poscount[i]++;
        else
            self->miscount[i]++;
    }
    // process hello function DOES NOT send out any messages. It updates the local
    // data structures: poscount and miscount.
}


// Send out a hello message through the pipe..
void broadcast_hello_msg(jobjmanager_t *self)
{
    unsigned char buf[BEACON_PKT_SIZE];
    jmsg_t *jmsg = (jmsg_t *)buf;
    struct bloom *bloom = (struct bloom *)jmsg->payload;

    // whether this node is the sole owner of an object..
    bool exclusive = false;
    int mistotal = 0;

    // Create the bloom filter for the whole object possession...
    // Instead of saving this.. we need to recreate this filter so that we can
    // easily track the membership of objects.. deletions are impossible in a bloom filter
    bloom_init(bloom, 100, 0.01);
    // 100 elements are hard coded for now.. to fit the 255 byte limitation of the UDP beacon

    // TODO: What if the numofobjs is larger than 100?? We need to handle this problem.
    for (int i = 0; i < self->numofobjs; i++) {
        bloom_add(bloom, &(self->objs[i]), sizeof(jobject_t));

        if (self->miscount[i] > 0 && self->poscount[i] == 0)
            exclusive = true;

        mistotal += self->miscount[i];
    }

    // We send the broadcast if we hold an exclusive object or it is needed and it
    // the chance of this node to send the object. There might be multiple nodes thinking it
    // it is their chance or no one thinking... so multiple copies or No copies could show up

    // TODO: tighten this probabilistic broadcasting.. we could use the number of nodes?

    if (exclusive || (mistotal > 0 && (arc4random() % MAX_RANDOM_VAL <= MAX_RANDOM_VAL/4)) {
        // create zframe and send it.. to the jservice thread..
        jmsg->type = LAN_MSG_TYPE;
        zframe_t *frame = zframe_new(buf, BEACON_PKT_SIZE);
        zframe_send(&frame, self->pipe, 0);
    }
}


void process_lan_msg(jobjmanager_t *self, void *msg)
{
    bool found = false;

    // Unpack the message.. and assertain the message type
    jmsg_t *jmsg = (jmsg_t *)msg;
    assert(jmsg->type == LAN_MSG_TYPE);

    // Get the jobject...
    jobject_t *jobj = (jobject_t *)jmsg->payload;

    // if the key is found in the cache.. exit.. we have already seen it in the
    // recent past.. after the cache flush..
    if (zhash_lookup(self->cache, jobj->key))
        return;
    else
        zhash_insert(self->cache, jobj->key, jobj->value);

    // We still need to search the object table before the actual insertion..
    for (int i = 0; i < self->numofobjs; i++)
        if (streq(jobj->key, self->objs[i].key)) {
            found = true;
            break;
        }

    if (!found) {
        // at the end of the array copy the object
        self->numofobjs++;
        memcpy(&(self->objs[self->numofobjs]), jobj, sizeof(jobject_t));
    }
}


/*
 * A little bit about the gossip algorithm.
 * At the LAN level we are using the UDP broadcast.
 * Each node has WAN neighbors that were hard coded into the node.
 * Case (a): If the node is unable to connect or not willing to connect to
 * these neighbors, it will put their information into the local LAN hoping some
 * other node will be connecting to them.
 * Case (b): If the node is leaving it might want to share the WAN neighbours with
 * its LAN.. assuming this is not covered by Case (a).
 * Normally, each node includes what it finds as new objects through WAN gossip
 * into the object directory. This gets flooded to the local nodes. There is no
 * difference in the information objects.. there is a type to differentiate between
 * local advertisements and foreign advertisements. However, the scope of the
 * distribution algorithm is the same.
 */

/*
 * Do WAN gossip. We need to send information to the WAN neighbors. Which neighbors
 * do we pick? At each step we decide (k, n) for the gossip, where k is the selected
 * targets out of the available n. Generate a bit patterns with n bits with the first
 * k bits 1 and the rest 0. Create a random permutation of this string. Use the string
 * to send the gossip.
 */

void do_gossip(jobjmanager_t *self)
{
    // gossiping is not enabled... so just return;
    if (!self->gossiping)
        return;

    // Get the gossip order.. these are nodes to send messages to
    int *targets = gossip_neighbors(self->ncount, self->fanout);

    for (int i = 0; i < self->ncount; i++) {
        if (targets[i]) {
            

        }
    }
}




/*
 * Process the incoming gossip message.
 */
void process_gossip(jobjmanager_t *self, void *msg)
{


}


bool load_gossip_neighbors(jobjmanager_t *self, char *filename)
{
    char *neighbor;

    zconfig_t *conf = zconfig_load(filename);
    if (conf == NULL) {
        printf("\nWARNING: No neighbor configuration found. \nGossip disabled\n");
        return false;
    }
        conf = zconfig_new("gossip", NULL);
    self->conf = conf;

    char *fanout = zconfig_get(conf, "/gossip/fanout", NULL);
    char *count = zconfig_get(conf, "/gossip/count", NULL);
    if (fanout && count) {
        self->fanout = atoi(fanout);
        self->ncount = atoi(count);

        // Neighbor information - IP address or hostnames..
        *(self->neighbors) = (char *)calloc(self->ncount, sizeof(char *));

        for (int i = 0; i < cnt; i++) {
            char sbuf[32];
            sprintf(sbuf, "/gossip/neighbor-%d", i);
            char *neighbor = zconfig_get(conf, sbuf, NULL);
            if (neighbor)
                self->neighbors[i] = strdup(neighbor);
            else
                return false;
        }
    } else
        return false;

    return true;
}


jobjmanager_t *create_jobjmanager(zsock_t *pipe)
{
    // create the jobj manager structure..
    jobjmanager_t *self = (jobjmanager_t *)calloc(1, sizeof(jobjmanager_t));

    // create the hash table..
    self->cache = zhash_new();
    assert(self->cache);
    zhash_autofree(self->cache);

    // we need to have a properly created node.conf file to have gossip enabled.
    self->gossiping = load_gossip_neighbors(self, "node.conf");

    // set some default parameters..
    self->terminated = false;
    self->pipe = pipe;
    self->verbose = false;

    self->numofobjs = 0;

    // Allocate the object array..
    self->objs = (jobject_t *)calloc(MAX_JOBJECTS, sizeof(jobject_t));

    // Allocate the missing count array.. calloc does the initialization to 0
    self->miscount = (int *)calloc(MAX_JOBJECTS, sizeof(int));

    // Allocate the possession count array.. calloc does the initialization to 0
    self->poscount = (int *)calloc(MAX_JOBJECTS, sizeof(int));

    return self;
}


void jobjmanager_main(zsock_t *pipe, void *args)
{
    jobjmanager_t *self = create_jobjmanager(pipe);

    zsock_signal(pipe, 0);

    while(!self->terminated) {
        zmq_pollitem_t items[] = { {zsock_resolve(pipe), 0, ZMQ_POLLIN, 0} };
        if (zmq_poll(items, 1, 10) == -1)
            break;
        if (items[0].revents & ZMQ_POLLIN)
            handle_pipe(self, args);

        if (args != NULL)
            printf("%s\n", (char *)args);
        else
            printf("+++");
        zclock_sleep(150);
    }
}
