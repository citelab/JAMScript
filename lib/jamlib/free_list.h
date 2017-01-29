#ifndef __FREE_LIST__
#define __FREE_LIST__

#define _DEFAULT_SIZE_ 2
#include <stdlib.h>
struct alloc_memory_list{
  void ** ptr;
  int size;
  int max;
}alloc_list;

struct alloc_memory_list *init_list_();
void add_to_list(void * ptr, struct alloc_memory_list * list);
void list_free(struct alloc_memory_list * list);

#endif
