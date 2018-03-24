#include "free_list.h"

struct alloc_memory_list *init_list_(){
  struct alloc_memory_list *ret = calloc(1, sizeof(alloc_list));
  ret->ptr = calloc(2, sizeof(void *));
  ret->max = _DEFAULT_SIZE_;
  ret->size = 0;
  return ret;
}

void add_to_list(void * ptr, struct alloc_memory_list * list){
  if(list->size == list->max){
    list->max *= 2;
    list->ptr = realloc(list->ptr, sizeof(void *) * list->max);
  }
  list->ptr[list->size++] = ptr;
}

void list_free(struct alloc_memory_list * list){
  free(list->ptr);
  free(list);
}
