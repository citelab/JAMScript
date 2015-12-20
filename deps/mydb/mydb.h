#include <stdbool.h>

// This is to make the free block search a little faster
#define FREE_LIST_SIZE                      16


// TODO: We need periodic compaction to make sure we are not consuming too many slots.
// As it is now, the slot count does not decrease at deletion. Only the record count decreases
// the slot count keeps growing with additions as new space in the file system is used. So the
// disk file also keeps growing monotonically..

typedef struct _mydbstate
{
    int keylen;
    int datalen;
    int numrecs;                            // Total number of records (decreases with deletion)
    int numslots;                           // Total number of slots (decreases only at compaction)
    int freelist[FREE_LIST_SIZE];
    int beginoffset;

} mydbstate_t;


typedef struct _mydb
{
    mydbstate_t state;
    int fdesc;

} mydb_t;


typedef struct _mydbiter
{
    mydb_t *db;
    int curindx;

} mydbiter_t;


/*
 * Function prototypes..
 */

int get_free_record(mydb_t *db);
bool rebuild_free_list(mydb_t *db);
void add_free_records(mydb_t *db, int *from);
void add_to_freelist(mydb_t *db, int rec);
bool check_zero_key(mydb_t *db, void *key);
bool check_equal_key(mydb_t *db, void *ckey, void *rkey);
bool check_equal_data(mydb_t *db, void *cdata, void *rdata);

int search_database(mydb_t *db, void *rkey);
int mywrite(int fd, void *data, int datalen, int offset);
int myread(int fd, void *data, int datalen, int offset);

bool database_put(mydb_t *mydb, void *key, void *data);
bool database_get(mydb_t *mydb, void *key, void *data);
bool database_del(mydb_t *mydb, void *key);

mydb_t *open_database(char *filename, int keylen, int datalen);
void close_database(mydb_t *db);
mydbiter_t *get_iterator(mydb_t *db);
void destroy_iterator(mydbiter_t *dbi);
bool get_next_record(mydbiter_t *dbi, char *key, void *data);
bool del_prev_record(mydbiter_t *dbi);
