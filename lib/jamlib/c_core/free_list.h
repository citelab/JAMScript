#pragma once

#define _DEFAULT_SIZE_ 2
struct alloc_memory_list{
  void ** ptr;
  int size;
  int max;
}alloc_list;

struct alloc_memory_list *init_list_();
void add_to_list_(void * ptr, struct alloc_memory_list * list);
void list_free(struct alloc_memory_list * list);
